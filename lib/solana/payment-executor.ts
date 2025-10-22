import {
  appendTransactionMessageInstructions,
  compileTransaction,
  createTransactionMessage,
  getTransactionEncoder,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransaction,
  address,
} from "@solana/kit";
import {
  getSetComputeUnitLimitInstruction,
  getSetComputeUnitPriceInstruction,
} from "@solana-program/compute-budget";
import { 
  getTransferCheckedInstruction, 
  TOKEN_PROGRAM_ADDRESS 
} from "@solana-program/token";
import { createKeyPairSignerFromBytes } from "@solana/signers";
import { SanctumGatewayClient } from "./sanctum-gateway";
import {
  createPayment,
  updatePayment,
  createPlatformRevenue,
  getPlatformConfig,
  addToDeadLetterQueue,
} from "@/lib/db/payment-queries";
import bs58 from "bs58";
import { PaymentSession, Product } from "../db/schema";

export enum PaymentErrorType {
  NETWORK_ERROR = "NETWORK_ERROR",
  INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE",
  INVALID_TRANSACTION = "INVALID_TRANSACTION",
  TIMEOUT = "TIMEOUT",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

// ============================================================================
// PAYMENT EXECUTOR
// ============================================================================

export class PaymentExecutor {
  private gateway: SanctumGatewayClient;
  private backendSigner!: Awaited<ReturnType<typeof createKeyPairSignerFromBytes>>;
  private keyPair = process.env.BACKEND_KEYPAIR;

  private constructor() {
    this.gateway = new SanctumGatewayClient();
    if (!this.keyPair) {
      throw Error("Backend keypair not set");
    }
  }

  static async create(): Promise<PaymentExecutor> {
    const executor = new PaymentExecutor();
    const keypairBytes = bs58.decode(executor.keyPair!);
    executor.backendSigner = await createKeyPairSignerFromBytes(keypairBytes);
    return executor;
  }

  /**
   * Execute a direct transfer from customer to merchant + platform
   * Customer pays everything (no delegation needed!)
   */
  async executeDirectPayment(
    session: PaymentSession & { product: Product & { organization: any } },
    customerWallet: string,
    customerTokenAccount: string
  ): Promise<{ txSignature: string; payment: any }> {
    console.log(`💰 Executing payment for session ${session.id}`);

    // Get platform config
    const platformConfig = await getPlatformConfig();
    if (!platformConfig) {
      throw new Error('Platform config not found');
    }

    const merchantAmount = BigInt(session.amount);
    const platformFee = BigInt(session.platformFee);
    const totalAmount = BigInt(session.totalAmount);

    try {
      const instructions: any[] = [];
      const tokenMintAddr = address(session.tokenMint);
      const customerWalletAddr = address(customerWallet);
      const customerTokenAccountAddr = address(customerTokenAccount);

      // 1. TRANSFER TO MERCHANT
      const merchantTransferIx = getTransferCheckedInstruction({
        source: customerTokenAccountAddr,
        mint: tokenMintAddr,
        destination: address(session.merchantWallet),
        authority: customerWalletAddr,
        amount: merchantAmount,
        decimals: session.tokenDecimals,
      });

      // 2. TRANSFER TO PLATFORM
      const platformTransferIx = getTransferCheckedInstruction({
        source: customerTokenAccountAddr,
        mint: tokenMintAddr,
        destination: address(platformConfig.platformFeeWallet),
        authority: customerWalletAddr,
        amount: platformFee,
        decimals: session.tokenDecimals,
      });

      // 3. GET PRIORITY FEE AND TIP
      const [{ value: latestBlockhash }, priorityFee, tipIxs] = await Promise.all([
        this.gateway.getLatestBlockhash(),
        this.gateway.getPriorityFee([
          customerTokenAccount,
          session.merchantWallet,
          platformConfig.platformFeeWallet,
        ]),
        this.gateway.getTipInstructions(this.backendSigner.address),
      ]);

      // 4. BUILD COMPUTE BUDGET
      const cuLimit = 300000;
      const cuPrice = BigInt(Math.floor(Number(priorityFee) * 1.2));
      const cuLimitIx = getSetComputeUnitLimitInstruction({ units: cuLimit });
      const cuPriceIx = getSetComputeUnitPriceInstruction({ microLamports: cuPrice });

      // Calculate total gas cost
      const tipAmount = tipIxs.reduce((sum, ix) => sum + BigInt(5000), BigInt(0));
      const totalGasCost = (cuPrice * BigInt(cuLimit) / BigInt(1000000)) + tipAmount;

      // 5. ADD ALL INSTRUCTIONS
      instructions.push(cuLimitIx, cuPriceIx, merchantTransferIx, platformTransferIx, ...tipIxs);

      // 6. BUILD TRANSACTION (Customer is fee payer!)
      const transaction = pipe(
        createTransactionMessage({ version: 0 }),
        (txm) => appendTransactionMessageInstructions(instructions, txm),
        (txm) => setTransactionMessageFeePayerSigner(
          { address: customerWalletAddr } as any,
          txm
        ),
        (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
        compileTransaction
      );

      const readonlyBytes = getTransactionEncoder().encode(transaction);
      const transactionBytes = new Uint8Array(readonlyBytes);

      // This transaction will be returned to frontend for customer to sign
      // For now, we'll just return the unsigned transaction
      const base64Transaction = Buffer.from(transactionBytes).toString('base64');

      return {
        txSignature: '', // Will be filled after customer signs
        payment: {
          sessionId: session.id,
          productId: session.productId,
          organizationId: session.organizationId,
          merchantAmount: merchantAmount.toString(),
          platformFee: platformFee.toString(),
          totalAmount: totalAmount.toString(),
          gasCost: totalGasCost.toString(),
          transaction: base64Transaction,
        },
      };
    } catch (error: any) {
      console.error(`❌ Payment failed:`, error);
      
      await addToDeadLetterQueue({
        sessionId: session.id,
        errorType: PaymentErrorType.UNKNOWN_ERROR,
        errorMessage: error.message,
        metadata: { session },
      });

      throw error;
    }
  }

  /**
   * Confirm payment after customer signs and submits transaction
   */
  async confirmPayment(
    sessionId: string,
    txSignature: string
  ): Promise<{ confirmed: boolean; payment?: any }> {
    console.log(`✅ Confirming payment: ${txSignature}`);

    try {
      // Wait for transaction confirmation
      const confirmed = await this.gateway.confirmTransaction(txSignature, 30);

      if (!confirmed) {
        throw new Error('Transaction confirmation timeout');
      }

      // Get session details
      const session = await this.getSessionById(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      // Create payment record
      const payment = await createPayment({
        sessionId,
        productId: session.productId,
        organizationId: session.organizationId,
        merchantAmount: session.amount,
        platformFee: session.platformFee,
        totalAmount: session.totalAmount,
        gasCost: '0', // Customer paid gas
        txSignature,
        deliveryMethod: 'customer_signed',
      });

      // Update payment status
      await updatePayment(payment.id, { status: 'confirmed' });

      // Record platform revenue
      const platformConfig = await getPlatformConfig();
      if (platformConfig) {
        await createPlatformRevenue({
          paymentId: payment.id,
          organizationId: session.organizationId,
          feeAmount: session.platformFee,
          merchantAmount: session.amount,
          totalAmount: session.totalAmount,
          gasCost: '0',
          txSignature,
        });
      }

      console.log(`✅ Payment confirmed: ${txSignature}`);
      return { confirmed: true, payment };
    } catch (error: any) {
      console.error(`❌ Payment confirmation failed:`, error);
      return { confirmed: false };
    }
  }

  private async getSessionById(sessionId: string) {
    // Import from queries
    const { getPaymentSessionById } = await import('@/lib/db/payment-queries');
    return await getPaymentSessionById(sessionId);
  }
}
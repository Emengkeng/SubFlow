import {
  appendTransactionMessageInstructions,
  compileTransaction,
  createTransactionMessage,
  getTransactionEncoder,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  address,
  blockhash,
} from "@solana/kit";
import { getTransferCheckedInstruction } from "@solana-program/token";
import { SanctumGatewayClient } from "./sanctum-gateway";
import {
  createPayment,
  updatePayment,
  createPlatformRevenue,
  getPlatformConfig,
  addToDeadLetterQueue,
} from "@/lib/db/payment-queries";
import { PaymentSession, Product } from "../db/schema";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

export enum PaymentErrorType {
  NETWORK_ERROR = "NETWORK_ERROR",
  INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE",
  INVALID_TRANSACTION = "INVALID_TRANSACTION",
  TIMEOUT = "TIMEOUT",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

export class PaymentExecutor {
  private gateway: SanctumGatewayClient;

  constructor() {
    this.gateway = new SanctumGatewayClient();
  }

  static async create(): Promise<PaymentExecutor> {
    return new PaymentExecutor();
  }

  /**
   * Execute a direct transfer from customer to merchant + platform
   * Uses Sanctum Gateway's buildGatewayTransaction for optimization
   * Customer signs and transaction is sent via Gateway's multi-path delivery
   */
  async executeDirectPayment(
    session: PaymentSession & { product: Product & { organization: any } },
    customerWallet: string
  ): Promise<{ txSignature: string; payment: any }> {
    console.log(`💰 Executing payment for session ${session.id}`);

    const platformConfig = await getPlatformConfig();
    if (!platformConfig) {
      throw new Error('Platform config not found');
    }

    const merchantAmount = BigInt(session.amount);
    const platformFee = BigInt(session.platformFee);

    try {
      const instructions: any[] = [];
      const tokenMintAddr = address(session.tokenMint);
      const customerWalletAddr = address(customerWallet);

      // Derive token accounts
      const customerTokenAccount = getAssociatedTokenAddressSync(
        new PublicKey(session.tokenMint),
        new PublicKey(customerWallet)
      );
      const merchantTokenAccount = getAssociatedTokenAddressSync(
        new PublicKey(session.tokenMint),
        new PublicKey(session.merchantWallet)
      );
      const platformTokenAccount = getAssociatedTokenAddressSync(
        new PublicKey(session.tokenMint),
        new PublicKey(platformConfig.platformFeeWallet)
      );

      console.log('🔍 Account Addresses:');
      console.log('   Customer wallet:', customerWallet);
      console.log('   Customer token account:', customerTokenAccount.toString());
      console.log('   Merchant token account:', merchantTokenAccount.toString());
      console.log('   Platform token account:', platformTokenAccount.toString());

      // Transfer to merchant
      const merchantTransferIx = getTransferCheckedInstruction({
        source: address(customerTokenAccount.toString()),
        mint: tokenMintAddr,
        destination: address(merchantTokenAccount.toString()),
        authority: customerWalletAddr,
        amount: merchantAmount,
        decimals: session.tokenDecimals,
      });

      // Transfer to platform
      const platformTransferIx = getTransferCheckedInstruction({
        source: address(customerTokenAccount.toString()),
        mint: tokenMintAddr,
        destination: address(platformTokenAccount.toString()),
        authority: customerWalletAddr,
        amount: platformFee,
        decimals: session.tokenDecimals,
      });

      instructions.push(merchantTransferIx, platformTransferIx);

      console.log(`📦 Built ${instructions.length} transfer instructions`);

      // ============================================================
      // KEY INTEGRATION: Use Sanctum Gateway's buildGatewayTransaction
      // This optimizes the transaction with:
      // - Simulation to determine optimal CU limit
      // - Real-time priority fee fetching
      // - Jito tip instructions for better delivery
      // - Fresh blockhash management
      // ============================================================
      
      const customerSigner = { address: customerWalletAddr };
      
      // Build initial unsigned transaction with dummy blockhash
      const initialTransaction = pipe(
        createTransactionMessage({ version: 0 }),
        (txm) => appendTransactionMessageInstructions(instructions, txm),
        (txm) => setTransactionMessageFeePayerSigner(customerSigner as any, txm),
        (m) => setTransactionMessageLifetimeUsingBlockhash(
          {
            blockhash: blockhash("11111111111111111111111111111111"),
            lastValidBlockHeight: 1000n,
          },
          m
        ),
        compileTransaction
      );

      console.log('🌐 Optimizing transaction via Sanctum Gateway buildGatewayTransaction...');
      
      const buildResult = await this.gateway.buildGatewayTransaction(
        initialTransaction,
        {
          skipSimulation: false,     // Let Gateway simulate and set CU limit
          skipPriorityFee: false,    // Let Gateway fetch and set priority fees
          cuPriceRange: "medium",    // Medium priority fees
          jitoTipRange: "medium",    // Medium Jito tips
          deliveryMethodType: "rpc",
        }
      );

      const optimizedTransactionBytes = getTransactionEncoder().encode(
        buildResult.transaction
      );
      const base64Transaction = Buffer.from(optimizedTransactionBytes).toString('base64');

      console.log('✅ Gateway-optimized transaction ready:');
      console.log('   Blockhash:', buildResult.latestBlockhash.blockhash.slice(0, 8) + '...');
      console.log('   Last Valid Block:', buildResult.latestBlockhash.lastValidBlockHeight);
      console.log('   Transaction size:', optimizedTransactionBytes.length, 'bytes');
      console.log('   Optimizations applied:');
      console.log('     ✓ CU limit set via simulation');
      console.log('     ✓ Priority fees fetched and applied');
      console.log('     ✓ Jito tip instructions added');
      console.log('     ✓ Fresh blockhash attached');

      return {
        txSignature: '',
        payment: {
          sessionId: session.id,
          productId: session.productId,
          organizationId: session.organizationId,
          merchantAmount: merchantAmount.toString(),
          platformFee: platformFee.toString(),
          totalAmount: session.totalAmount,
          gasCost: '0',
          transaction: base64Transaction,
          gatewayOptimized: true,
          blockhash: buildResult.latestBlockhash.blockhash,
        },
      };
    } catch (error: any) {
      console.error(`❌ Payment preparation failed:`, error);
      
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
   * Confirm a payment on-chain after customer signs and sends
   */
  async confirmPayment(
    sessionId: string,
    txSignature: string
  ): Promise<{ confirmed: boolean; payment?: any }> {
    console.log(`✅ Confirming payment: ${txSignature}`);

    try {
      // Use Gateway's confirmation tracking
      const confirmed = await this.gateway.confirmTransaction(txSignature, 30);

      if (!confirmed) {
        throw new Error('Transaction confirmation timeout');
      }

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
        gasCost: '0',
        txSignature,
        deliveryMethod: 'gateway_multi_path',
      });

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
    const { getPaymentSessionById } = await import('@/lib/db/payment-queries');
    return await getPaymentSessionById(sessionId);
  }
}
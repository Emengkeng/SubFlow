import {
  appendTransactionMessageInstructions,
  compileTransaction,
  createTransactionMessage,
  getTransactionEncoder,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  address,
} from "@solana/kit";
import {
  getSetComputeUnitLimitInstruction,
  getSetComputeUnitPriceInstruction,
} from "@solana-program/compute-budget";
import { 
  getTransferCheckedInstruction,
} from "@solana-program/token";
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
   * Customer signs and pays for everything (simple, reliable)
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
      console.log('Customer wallet:', customerWallet);
      console.log('Customer token account:', customerTokenAccount.toString());
      console.log('Merchant token account:', merchantTokenAccount.toString());
      console.log('Platform token account:', platformTokenAccount.toString());

      // Get blockchain data - CUSTOMER pays for tips
      // Always fetch fresh blockhash to avoid replay errors
      console.log('🔄 Fetching fresh blockhash and blockchain data...');
      
      const [{ value: latestBlockhash }, priorityFee, tipIxs] = await Promise.all([
        this.gateway.getLatestBlockhash(),
        this.gateway.getPriorityFee([
          customerTokenAccount.toString(),
          merchantTokenAccount.toString(),
          platformTokenAccount.toString(),
        ]),
        // CRITICAL: Pass CUSTOMER wallet as fee payer for tips
        this.gateway.getTipInstructions(customerWallet),
      ]);
      
      console.log('✅ Fresh blockhash obtained:', latestBlockhash.blockhash.slice(0, 8) + '...');

      console.log('✅ Tip instructions fetched (customer will pay)');

      // Build compute budget
      const cuLimit = 300000;
      const cuPrice = BigInt(Math.floor(Number(priorityFee) * 1.2));
      
      // Add a tiny bit of randomness to CU price to make each transaction unique
      // This prevents identical transactions with same blockhash
      const randomness = BigInt(Math.floor(Math.random() * 10));
      const uniqueCuPrice = cuPrice + randomness;
      
      const cuLimitIx = getSetComputeUnitLimitInstruction({ units: cuLimit });
      const cuPriceIx = getSetComputeUnitPriceInstruction({ microLamports: uniqueCuPrice });
      
      console.log('⚙️  Compute units:', cuLimit, '| Price:', uniqueCuPrice.toString(), 'micro-lamports');

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

      // Add all instructions including tips
      instructions.push(
        cuLimitIx, 
        cuPriceIx, 
        merchantTransferIx, 
        platformTransferIx, 
        ...tipIxs
      );

      console.log(`📦 Built transaction with ${instructions.length} instructions`);

      // Build transaction with customer as ONLY signer
      const customerSigner = { address: customerWalletAddr };
      
      const compiledTransaction = pipe(
        createTransactionMessage({ version: 0 }),
        (txm) => appendTransactionMessageInstructions(instructions, txm),
        (txm) => setTransactionMessageFeePayerSigner(customerSigner as any, txm),
        (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
        compileTransaction
      );

      // Serialize for frontend (NO backend signature - customer signs everything)
      const transactionBytes = getTransactionEncoder().encode(compiledTransaction);
      const base64Transaction = Buffer.from(transactionBytes).toString('base64');

      console.log('✅ Transaction compiled successfully');
      console.log('📊 Transaction size:', transactionBytes.length, 'bytes');
      console.log('👤 Fee payer:', customerWallet);
      console.log('✍️  Required signatures: 1 (customer only)');

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

  async confirmPayment(
    sessionId: string,
    txSignature: string
  ): Promise<{ confirmed: boolean; payment?: any }> {
    console.log(`✅ Confirming payment: ${txSignature}`);

    try {
      const confirmed = await this.gateway.confirmTransaction(txSignature, 30);

      if (!confirmed) {
        throw new Error('Transaction confirmation timeout');
      }

      const session = await this.getSessionById(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      const payment = await createPayment({
        sessionId,
        productId: session.productId,
        organizationId: session.organizationId,
        merchantAmount: session.amount,
        platformFee: session.platformFee,
        totalAmount: session.totalAmount,
        gasCost: '0',
        txSignature,
        deliveryMethod: 'customer_signed',
      });

      await updatePayment(payment.id, { status: 'confirmed' });

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
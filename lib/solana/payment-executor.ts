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

      console.log(`📦 Built transaction with ${instructions.length} transfer instructions`);
      
      // Build initial unsigned transaction
      const customerSigner = { address: customerWalletAddr };
      
      const initialTransaction = pipe(
        createTransactionMessage({ version: 0 }),
        (txm) => appendTransactionMessageInstructions(instructions, txm),
        (txm) => setTransactionMessageFeePayerSigner(customerSigner as any, txm),
        // Use dummy blockhash - Gateway will replace it
        (m) => setTransactionMessageLifetimeUsingBlockhash(
          {
            blockhash: blockhash("11111111111111111111111111111111"),
            lastValidBlockHeight: 1000n,
          },
          m
        ),
        compileTransaction
      );

      // Call Sanctum Gateway's buildGatewayTransaction
      console.log('🌐 Calling Sanctum Gateway buildGatewayTransaction...');
      const buildResponse = await this.gateway.buildGatewayTransaction(
        initialTransaction,
        {
          skipSimulation: false,
          skipPriorityFee: false,
          cuPriceRange: "medium",
          jitoTipRange: "medium",
          deliveryMethodType: "rpc",
        }
      );

      const optimizedTransactionBytes = getTransactionEncoder().encode(
        buildResponse.transaction
      );
      const base64Transaction = Buffer.from(optimizedTransactionBytes).toString('base64');

      console.log('✅ Gateway optimized transaction:');
      console.log('   - Blockhash:', buildResponse.latestBlockhash.blockhash.slice(0, 8) + '...');
      console.log('   - Transaction size:', optimizedTransactionBytes.length, 'bytes');
      console.log('   - CU limit & priority fee automatically set by Gateway');
      console.log('   - Jito tips added for better delivery');

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
          gatewayOptimized: true, // Flag to show Gateway was used
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
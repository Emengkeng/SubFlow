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
import { Connection, PublicKey } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";

export enum PaymentErrorType {
  NETWORK_ERROR = "NETWORK_ERROR",
  INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE",
  INVALID_TRANSACTION = "INVALID_TRANSACTION",
  TIMEOUT = "TIMEOUT",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

export class PaymentExecutor {
  private gateway: SanctumGatewayClient;
  private connection: Connection;

  constructor() {
    this.gateway = new SanctumGatewayClient();
    this.connection = new Connection(this.gateway.getrpcUrl);
  }

  static async create(): Promise<PaymentExecutor> {
    return new PaymentExecutor();
  }

  private async accountExists(accountAddress: PublicKey): Promise<boolean> {
    try {
      const accountInfo = await this.connection.getAccountInfo(accountAddress);
      return accountInfo !== null;
    } catch (error) {
      console.warn('Error checking account:', error);
      return false;
    }
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
      
      const tokenMintPubkey = new PublicKey(session.tokenMint);
      const customerWalletPubkey = new PublicKey(customerWallet);
      const merchantWalletPubkey = new PublicKey(session.merchantWallet);
      const platformWalletPubkey = new PublicKey(platformConfig.platformFeeWallet);

      // Derive token accounts
      const customerTokenAccount = getAssociatedTokenAddressSync(
        tokenMintPubkey,
        customerWalletPubkey
      );
      const merchantTokenAccount = getAssociatedTokenAddressSync(
        tokenMintPubkey,
        merchantWalletPubkey
      );
      const platformTokenAccount = getAssociatedTokenAddressSync(
        tokenMintPubkey,
        platformWalletPubkey
      );

      console.log('🔍 Account Addresses:');
      console.log('   Customer wallet:', customerWallet);
      console.log('   Customer token account:', customerTokenAccount.toString());
      console.log('   Merchant token account:', merchantTokenAccount.toString());
      console.log('   Platform token account:', platformTokenAccount.toString());

      // Check and create ATAs if they don't exist
      console.log('🔍 Checking token account existence...');
      
      const [customerExists, merchantExists, platformExists] = await Promise.all([
        this.accountExists(customerTokenAccount),
        this.accountExists(merchantTokenAccount),
        this.accountExists(platformTokenAccount)
      ]);

      console.log('   Customer ATA exists:', customerExists);
      console.log('   Merchant ATA exists:', merchantExists);
      console.log('   Platform ATA exists:', platformExists);

      // Add creation instructions for missing ATAs
      if (!customerExists) {
        console.log('➕ Adding instruction to create customer ATA');
        const createCustomerATAIx = createAssociatedTokenAccountInstruction(
          customerWalletPubkey, // payer
          customerTokenAccount,
          customerWalletPubkey, // owner
          tokenMintPubkey,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
        // Convert to @solana/kit format
        instructions.push({
          programAddress: address(ASSOCIATED_TOKEN_PROGRAM_ID.toString()),
          accounts: createCustomerATAIx.keys.map(k => ({
            address: address(k.pubkey.toString()),
            role: k.isWritable ? (k.isSigner ? 3 : 1) : (k.isSigner ? 2 : 0)
          })),
          data: createCustomerATAIx.data
        });
      }

      if (!merchantExists) {
        console.log('➕ Adding instruction to create merchant ATA');
        const createMerchantATAIx = createAssociatedTokenAccountInstruction(
          customerWalletPubkey, // payer (customer pays for merchant's ATA)
          merchantTokenAccount,
          merchantWalletPubkey, // owner
          tokenMintPubkey,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
        instructions.push({
          programAddress: address(ASSOCIATED_TOKEN_PROGRAM_ID.toString()),
          accounts: createMerchantATAIx.keys.map(k => ({
            address: address(k.pubkey.toString()),
            role: k.isWritable ? (k.isSigner ? 3 : 1) : (k.isSigner ? 2 : 0)
          })),
          data: createMerchantATAIx.data
        });
      }

      if (!platformExists) {
        console.log('➕ Adding instruction to create platform ATA');
        const createPlatformATAIx = createAssociatedTokenAccountInstruction(
          customerWalletPubkey, // payer (customer pays for platform's ATA)
          platformTokenAccount,
          platformWalletPubkey, // owner
          tokenMintPubkey,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
        instructions.push({
          programAddress: address(ASSOCIATED_TOKEN_PROGRAM_ID.toString()),
          accounts: createPlatformATAIx.keys.map(k => ({
            address: address(k.pubkey.toString()),
            role: k.isWritable ? (k.isSigner ? 3 : 1) : (k.isSigner ? 2 : 0)
          })),
          data: createPlatformATAIx.data
        });
      }

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

      console.log(`📦 Built ${instructions.length} instructions (${instructions.length - 2} ATA creation + 2 transfers)`);

      // ... rest of your code remains the same
      const customerSigner = { address: customerWalletAddr };
      
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
          skipSimulation: false,
          skipPriorityFee: false,
          cuPriceRange: "medium",
          jitoTipRange: "medium",
          deliveryMethodType: "rpc",
        }
      );

      const optimizedTransactionBytes = getTransactionEncoder().encode(
        buildResult.transaction
      );
      const base64Transaction = Buffer.from(optimizedTransactionBytes).toString('base64');

      console.log('✅ Gateway-optimized transaction ready');

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
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
import { findAssociatedTokenPda, getCreateAssociatedTokenInstructionAsync, getTransferCheckedInstruction, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { createKeyPairSignerFromBytes } from "@solana/signers";
import { SanctumGatewayClient } from "./sanctum-gateway";
import {
  createPayment,
  updatePayment,
  createPaymentError,
  addToDeadLetterQueue,
  createPlatformRevenue,
  getPlatformConfig,
} from "@/lib/db/subscription-queries";
import bs58 from "bs58";
import { Payment, Subscription } from "../db/schema";
import { bigint } from "drizzle-orm/gel-core";
import {
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";

// ============================================================================
// ERROR HANDLING
// ============================================================================

export enum PaymentErrorType {
  NETWORK_ERROR = "NETWORK_ERROR",
  RPC_TIMEOUT = "RPC_TIMEOUT",
  BLOCKHASH_NOT_FOUND = "BLOCKHASH_NOT_FOUND",
  CONGESTION = "CONGESTION",
  INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE",
  INVALID_DELEGATION = "INVALID_DELEGATION",
  DELEGATION_EXPIRED = "DELEGATION_EXPIRED",
  ACCOUNT_NOT_FOUND = "ACCOUNT_NOT_FOUND",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

interface ClassifiedError {
  type: PaymentErrorType;
  message: string;
  isRetryable: boolean;
  requiresUserAction: boolean;
}

class PaymentErrorClassifier {
  static classify(error: Error): ClassifiedError {
    const msg = error.message.toLowerCase();

    if (msg.includes("network") || msg.includes("timeout") || msg.includes("fetch failed")) {
      return {
        type: PaymentErrorType.NETWORK_ERROR,
        message: error.message,
        isRetryable: true,
        requiresUserAction: false,
      };
    }

    if (msg.includes("blockhash not found")) {
      return {
        type: PaymentErrorType.BLOCKHASH_NOT_FOUND,
        message: error.message,
        isRetryable: true,
        requiresUserAction: false,
      };
    }

    if (msg.includes("congestion")) {
      return {
        type: PaymentErrorType.CONGESTION,
        message: error.message,
        isRetryable: true,
        requiresUserAction: false,
      };
    }

    if (msg.includes("insufficient") || msg.includes("balance")) {
      return {
        type: PaymentErrorType.INSUFFICIENT_BALANCE,
        message: error.message,
        isRetryable: false,
        requiresUserAction: true,
      };
    }

    if (msg.includes("delegate") || msg.includes("approval")) {
      return {
        type: PaymentErrorType.INVALID_DELEGATION,
        message: error.message,
        isRetryable: false,
        requiresUserAction: true,
      };
    }

    return {
      type: PaymentErrorType.UNKNOWN_ERROR,
      message: error.message,
      isRetryable: true,
      requiresUserAction: false,
    };
  }
}

// ============================================================================
// PAYMENT EXECUTOR
// ============================================================================

export class PaymentExecutor {
  private gateway: SanctumGatewayClient;
  private backendSigner!: Awaited<ReturnType<typeof createKeyPairSignerFromBytes>>;
  private maxRetries = 3;
  private retryDelays = [5000, 30000, 300000]; // 5s, 30s, 5min
  private keyPair = process.env.BACKEND_KEYPAIR;

  private constructor() {
    this.gateway = new SanctumGatewayClient();
    if (!this.keyPair) {
      throw Error("Backend Key pair not set");
    }
  }

  static async create(): Promise<PaymentExecutor> {
    const executor = new PaymentExecutor();
    const keypairBytes = bs58.decode(executor.keyPair!);
    executor.backendSigner = await createKeyPairSignerFromBytes(keypairBytes);
    return executor;
  }

  async executePayment(subscription: Subscription & { plan: any }): Promise<Payment> {
    console.log(`Executing payment for subscription ${subscription.id}`);

    // Get platform config
    const platformConfig = await getPlatformConfig();
    if (!platformConfig) {
      throw new Error('Platform config not found');
    }

    const merchantAmount = BigInt(subscription.amountPerBilling);
    const platformFee = BigInt(platformConfig.platformFeeAmount);
    const totalAmount = merchantAmount + platformFee;

    const payment = await createPayment({
      subscriptionId: subscription.id,
      amount: totalAmount.toString(),
    });

    try {
      const instructions: any[] = [];

      // 1. CHECK AND CREATE TOKEN ACCOUNT IF NEEDED (BACKEND PAYS!)
      const userWalletAddr = address(subscription.userWallet);
      const tokenMintAddr = address(subscription.tokenMint);
      
      const [userTokenAccount] = await findAssociatedTokenPda({
        mint: tokenMintAddr,
        owner: userWalletAddr,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
      });

      // Check if token account exists
      const accountInfo = await this.gateway._rpc.getAccountInfo(
        userTokenAccount,
        { encoding: 'base64' }
      ).send();

      if (!accountInfo.value) {
        console.log("🔨 Creating user's token account (backend pays rent)...");
        
        const createAtaIx = await getOrCreateAssociatedTokenAccount({
          mint: tokenMintAddr,
          owner: userWalletAddr,
          payer: this.backendSigner.address,
        });
        
        instructions.push(createAtaIx);
        console.log("✅ Token account creation instruction added");
      }

      // 2. BUILD TRANSFER INSTRUCTIONS
      const merchantTransferIx = getTransferCheckedInstruction({
        source: address(subscription.userTokenAccount),
        mint: tokenMintAddr,
        destination: address(subscription.merchantTokenAccount),
        authority: userWalletAddr,
        amount: merchantAmount,
        decimals: subscription.tokenDecimals,
        multiSigners: [this.backendSigner],
      });

      const platformTransferIx = getTransferCheckedInstruction({
        source: address(subscription.userTokenAccount),
        mint: tokenMintAddr,
        destination: address(platformConfig.platformFeeWallet),
        authority: userWalletAddr,
        amount: platformFee,
        decimals: subscription.tokenDecimals,
        multiSigners: [this.backendSigner],
      });

      // 3. GET PRIORITY FEE AND TIP INSTRUCTIONS
      const [{ value: latestBlockhash }, priorityFee, tipIxs] = await Promise.all([
        this.gateway.getLatestBlockhash(),
        this.gateway.getPriorityFee([
          subscription.userTokenAccount,
          subscription.merchantTokenAccount,
          platformConfig.platformFeeWallet,
        ]),
        this.gateway.getTipInstructions(this.backendSigner.address),
      ]);

      // 4. BUILD COMPUTE BUDGET INSTRUCTIONS
      const cuLimit = instructions.length > 0 ? 400000 : 300000; // Higher if creating ATA
      const cuPrice = BigInt(Math.floor(Number(priorityFee) * 1.2));
      const cuLimitIx = getSetComputeUnitLimitInstruction({ units: cuLimit });
      const cuPriceIx = getSetComputeUnitPriceInstruction({ microLamports: cuPrice });

      // Calculate total gas cost (priority fee + tip + ATA rent if applicable)
      const tipAmount = tipIxs.reduce((sum, ix) => sum + BigInt(5000), BigInt(0));
      const ataRent = instructions.length > 0 ? BigInt(2039280) : BigInt(0); // ~0.002 SOL
      const totalGasCost = (cuPrice * BigInt(cuLimit) / BigInt(1000000)) + tipAmount + ataRent;

      // 5. ADD ALL INSTRUCTIONS IN ORDER
      instructions.unshift(cuLimitIx, cuPriceIx); // Compute budget first
      instructions.push(merchantTransferIx, platformTransferIx, ...tipIxs);

      // 6. BUILD AND SIGN TRANSACTION
      const transaction = pipe(
        createTransactionMessage({ version: 0 }),
        (txm) => appendTransactionMessageInstructions(instructions, txm),
        (txm) => setTransactionMessageFeePayerSigner(this.backendSigner, txm),
        (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
        compileTransaction
      );

      const signedTransaction = await signTransaction(
        [this.backendSigner.keyPair],
        transaction
      );

      const readonlyBytes = getTransactionEncoder().encode(signedTransaction);
      const transactionBytes = new Uint8Array(readonlyBytes);

      // 7. SEND VIA SANCTUM GATEWAY
      const result = await this.gateway.sendTransaction(transactionBytes);

      // 8. UPDATE PAYMENT RECORD
      await updatePayment(payment.id, {
        status: 'sent',
        txSignature: result.signature,
        deliveryMethod: result.deliveryMethod,
        slotSent: result.slot,
        priorityFee: totalGasCost.toString(),
      });

      // 9. RECORD PLATFORM REVENUE
      await createPlatformRevenue({
        paymentId: payment.id,
        subscriptionId: subscription.id,
        organizationId: subscription.plan.organizationId,
        feeAmount: platformFee.toString(),
        merchantAmount: merchantAmount.toString(),
        totalAmount: totalAmount.toString(),
        gasCost: totalGasCost.toString(),
        txSignature: result.signature,
      });

      console.log(`✅ Payment sent: ${result.signature}`);
      console.log(`💰 Merchant: ${merchantAmount}, Platform: ${platformFee}, Gas: ${totalGasCost}`);
      
      return { ...payment, txSignature: result.signature, status: 'sent' };
    } catch (error: any) {
      console.error(`❌ Payment failed:`, error);
      await updatePayment(payment.id, {
        status: 'failed',
        errorMessage: error.message,
      });
      throw error;
    }
  }

  async executePaymentWithRetry(subscription: Subscription & { plan: any }): Promise<Payment> {
    let lastError: any = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const payment = await this.executePayment(subscription);
        
        // Confirm transaction
        const confirmed = await this.gateway.confirmTransaction(payment.txSignature!);
        
        if (confirmed) {
          await updatePayment(payment.id, { status: 'confirmed' });
          console.log(`✅ Payment confirmed: ${payment.txSignature}`);
        }
        
        return payment;
      } catch (error: any) {
        lastError = error;
        console.warn(`Attempt ${attempt + 1}/${this.maxRetries} failed: ${error.message}`);

        if (attempt === this.maxRetries - 1) {
          break;
        }

        await this.sleep(this.retryDelays[attempt]);
      }
    }

    throw new Error(`Payment failed after ${this.maxRetries} attempts: ${lastError?.message}`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
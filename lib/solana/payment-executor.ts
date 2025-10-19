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
import { getTransferCheckedInstruction } from "@solana-program/token";
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

  // Private constructor - use PaymentExecutor.create() instead
  private constructor() {
    this.gateway = new SanctumGatewayClient();
    if (!this.keyPair) {
      throw Error("Backend Key pair not set");
    }
  }

  /**
   * Static factory method to create an initialized PaymentExecutor
   * Usage: const executor = await PaymentExecutor.create();
   */
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
      amount: totalAmount.toString(), // Total includes fee
    });

    try {
      // Build TWO transfer instructions: one to merchant, one to platform
      const merchantTransferIx = getTransferCheckedInstruction({
        source: address(subscription.userTokenAccount),
        mint: address(subscription.tokenMint),
        destination: address(subscription.merchantTokenAccount),
        owner: address(subscription.userWallet),
        amount: merchantAmount,
        decimals: subscription.tokenDecimals,
        multiSigners: [this.backendSigner],
      });

      const platformTransferIx = getTransferCheckedInstruction({
        source: address(subscription.userTokenAccount),
        mint: address(subscription.tokenMint),
        destination: address(platformConfig.platformFeeWallet),
        owner: address(subscription.userWallet),
        amount: platformFee,
        decimals: subscription.tokenDecimals,
        multiSigners: [this.backendSigner],
      });

      // Get priority fee and tip instructions
      const [{ value: latestBlockhash }, priorityFee, tipIxs] = await Promise.all([
        this.gateway.getLatestBlockhash(),
        this.gateway.getPriorityFee([
          subscription.userTokenAccount,
          subscription.merchantTokenAccount,
          platformConfig.platformFeeWallet,
        ]),
        this.gateway.getTipInstructions(this.backendSigner.address),
      ]);

      // Build compute budget instructions
      const cuLimit = 300000n; // Increased for 2 transfers
      const cuPrice = BigInt(Math.floor(Number(priorityFee) * 1.2));
      const cuLimitIx = getSetComputeUnitLimitInstruction({ units: cuLimit });
      const cuPriceIx = getSetComputeUnitPriceInstruction({ microLamports: cuPrice });

      // Calculate total gas cost (priority fee + tip)
      const tipAmount = tipIxs.reduce((sum, ix) => {
        // Extract tip amount from instruction (approximate)
        return sum + BigInt(5000); // Jito tip ~0.000005 SOL
      }, BigInt(0));
      const totalGasCost = (cuPrice * cuLimit / BigInt(1000000)) + tipAmount;

      // Build and compile transaction with BOTH transfers
      const transaction = pipe(
        createTransactionMessage({ version: 0 }),
        (txm) =>
          appendTransactionMessageInstructions(
            [cuLimitIx, cuPriceIx, merchantTransferIx, platformTransferIx, ...tipIxs],
            txm
          ),
        (txm) => setTransactionMessageFeePayerSigner(this.backendSigner, txm),
        (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
        compileTransaction
      );

      // Sign transaction
      const signedTransaction = await signTransaction(
        [this.backendSigner.keyPair],
        transaction
      );

      // Serialize transaction to bytes
      const readonlyBytes = getTransactionEncoder().encode(signedTransaction);
      const transactionBytes = new Uint8Array(readonlyBytes);

      // Send via Sanctum Gateway
      const result = await this.gateway.sendTransaction(transactionBytes);

      // Update payment record
      await updatePayment(payment.id, {
        status: 'sent',
        txSignature: result.signature,
        deliveryMethod: result.deliveryMethod,
        slotSent: result.slot,
        priorityFee: totalGasCost.toString(),
      });

      // Record platform revenue
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
    let lastError: ClassifiedError | null = null;

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
        const classifiedError = PaymentErrorClassifier.classify(error);
        lastError = classifiedError;

        console.warn(`Attempt ${attempt + 1}/${this.maxRetries} failed: ${error.message}`);

        if (!classifiedError.isRetryable || attempt === this.maxRetries - 1) {
          break;
        }

        await this.sleep(this.retryDelays[attempt]);
      }
    }

    // All retries failed - handle error
    if (lastError && !lastError.isRetryable) {
      await addToDeadLetterQueue({
        errorType: lastError.type,
        errorMessage: lastError.message,
        metadata: {
          subscriptionId: subscription.id,
          userWallet: subscription.userWallet,
          amount: subscription.amountPerBilling,
        },
      });
    }

    throw new Error(`Payment failed after ${this.maxRetries} attempts: ${lastError?.message}`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
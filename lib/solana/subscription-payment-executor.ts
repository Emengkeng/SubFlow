import {
  appendTransactionMessageInstructions,
  compileTransaction,
  createTransactionMessage,
  getTransactionEncoder,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  address,
  signTransaction,
} from "@solana/kit";
import {
  getSetComputeUnitLimitInstruction,
  getSetComputeUnitPriceInstruction,
} from "@solana-program/compute-budget";
import { getTransferCheckedInstruction } from "@solana-program/token";
import { SanctumGatewayClient } from "./sanctum-gateway";
import { createKeyPairSignerFromBytes } from "@solana/signers";
import {
  createSubscriptionPayment,
  updateSubscriptionPayment,
  updateSubscription,
  getPlatformConfig,
  createWebhook,
} from "@/lib/db/payment-queries";
import { Subscription, SubscriptionPlan } from "../db/schema";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import bs58 from "bs58";

export class SubscriptionPaymentExecutor {
  private gateway: SanctumGatewayClient;
  private backendSigner?: Awaited<ReturnType<typeof createKeyPairSignerFromBytes>>;

  constructor() {
    this.gateway = new SanctumGatewayClient();
  }

  private async initBackendSigner() {
    if (!this.backendSigner) {
      const keyPair = process.env.BACKEND_KEYPAIR;
      if (!keyPair) {
        throw Error("Backend keypair not set");
      }
      
      let keypairBytes: Uint8Array;
      
      try {
        keypairBytes = bs58.decode(keyPair);
      } catch {
        const parsed = JSON.parse(keyPair);
        if (Array.isArray(parsed)) {
          keypairBytes = new Uint8Array(parsed);
        } else {
          throw new Error("Invalid keypair format");
        }
      }
      
      if (keypairBytes.length !== 64) {
        throw new Error(`Invalid keypair length: ${keypairBytes.length}`);
      }
      
      this.backendSigner = await createKeyPairSignerFromBytes(keypairBytes);
      console.log(`✅ Backend signer initialized: ${this.backendSigner.address}`);
    }
    return this.backendSigner;
  }

  /**
   * Execute recurring payment using delegation
   * Backend signs transaction - NO USER INTERACTION NEEDED! 🎉
   */
  async executeRecurringPayment(
    subscription: Subscription & { plan: SubscriptionPlan & { organization: any } }
  ): Promise<{ success: boolean; txSignature?: string; error?: string }> {
    console.log(`💰 Processing recurring payment for subscription ${subscription.id}`);

    const backendSigner = await this.initBackendSigner();
    const platformConfig = await getPlatformConfig();
    
    if (!platformConfig) {
      throw new Error('Platform config not found');
    }

    const merchantAmount = BigInt(subscription.amount);
    const platformFee = BigInt(subscription.platformFee);
    const totalAmount = merchantAmount + platformFee;

    // Create payment record
    const payment = await createSubscriptionPayment({
      subscriptionId: subscription.id,
      amount: subscription.amount,
      platformFee: subscription.platformFee,
      totalAmount: subscription.totalAmount,
    });

    try {
      const tokenMintAddr = address(subscription.plan.tokenMint);

      // Derive token accounts
      const userTokenAccount = address(subscription.userTokenAccount);
      const merchantTokenAccount = getAssociatedTokenAddressSync(
        new PublicKey(subscription.plan.tokenMint),
        new PublicKey(subscription.plan.merchantTokenAccount)
      );
      const platformTokenAccount = getAssociatedTokenAddressSync(
        new PublicKey(subscription.plan.tokenMint),
        new PublicKey(platformConfig.platformFeeWallet)
      );

      console.log('🔍 Recurring Payment Accounts:');
      console.log('User token account:', userTokenAccount);
      console.log('Merchant token account:', merchantTokenAccount.toString());
      console.log('Platform token account:', platformTokenAccount.toString());
      console.log('Backend signer (delegate):', backendSigner.address);

      // Get blockchain data - BACKEND pays for tips
      const [{ value: latestBlockhash }, priorityFee, tipIxs] = await Promise.all([
        this.gateway.getLatestBlockhash(),
        this.gateway.getPriorityFee([
          userTokenAccount.toString(),
          merchantTokenAccount.toString(),
          platformTokenAccount.toString(),
        ]),
        // CRITICAL: Backend pays tips (we're the fee payer)
        this.gateway.getTipInstructions(backendSigner.address),
      ]);

      console.log('✅ Blockchain data fetched');

      const instructions: any[] = [];

      // Compute budget
      const cuLimit = 300000;
      const cuPrice = BigInt(Math.floor(Number(priorityFee) * 1.2));
      const randomness = BigInt(Math.floor(Math.random() * 10));
      const uniqueCuPrice = cuPrice + randomness;
      
      const cuLimitIx = getSetComputeUnitLimitInstruction({ units: cuLimit });
      const cuPriceIx = getSetComputeUnitPriceInstruction({ microLamports: uniqueCuPrice });

      // CRITICAL: Use delegation to transfer from user's account
      // Backend signs as delegate, NOT as user
      const merchantTransferIx = getTransferCheckedInstruction({
        source: userTokenAccount,
        mint: tokenMintAddr,
        destination: address(merchantTokenAccount.toString()),
        authority: address(backendSigner.address), // Backend is delegate!
        amount: merchantAmount,
        decimals: subscription.plan.tokenDecimals,
      });

      const platformTransferIx = getTransferCheckedInstruction({
        source: userTokenAccount,
        mint: tokenMintAddr,
        destination: address(platformTokenAccount.toString()),
        authority: address(backendSigner.address), // Backend is delegate!
        amount: platformFee,
        decimals: subscription.plan.tokenDecimals,
      });

      instructions.push(
        cuLimitIx,
        cuPriceIx,
        merchantTransferIx,
        platformTransferIx,
        ...tipIxs
      );

      console.log(`📦 Built transaction with ${instructions.length} instructions`);
      console.log('✍️  Signing as delegate (backend) - no user signature needed!');

      // Build and SIGN transaction (backend signs everything)
      const compiledTransaction = pipe(
        createTransactionMessage({ version: 0 }),
        (txm) => appendTransactionMessageInstructions(instructions, txm),
        (txm) => setTransactionMessageFeePayerSigner(backendSigner, txm),
        (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
        compileTransaction
      );

      // Backend signs (using delegation authority)
      const signedTransaction = await signTransaction(
        [backendSigner.keyPair],
        compiledTransaction
      );

      const transactionBytes = getTransactionEncoder().encode(signedTransaction);
      const base64Transaction = Buffer.from(transactionBytes).toString('base64');

      console.log('✅ Transaction signed by backend');
      console.log('📊 Transaction size:', transactionBytes.length, 'bytes');

      // Send via gateway
      const result = await this.gateway.sendTransaction(base64Transaction);
      const txSignature = result.signature;

      console.log('📡 Transaction sent:', txSignature);
      console.log('🚀 Delivery method:', result.deliveryMethod);

      // Confirm transaction
      const confirmed = await this.gateway.confirmTransaction(txSignature, 30);

      if (!confirmed) {
        throw new Error('Transaction confirmation timeout');
      }

      console.log('✅ Transaction confirmed!');

      // Update payment record
      await updateSubscriptionPayment(payment.id, {
        status: 'confirmed',
        txSignature,
        deliveryMethod: result.deliveryMethod,
      });

      // Update subscription
      const nextBillingDate = new Date(subscription.nextBillingDate);
      nextBillingDate.setDate(
        nextBillingDate.getDate() + subscription.plan.billingPeriodDays
      );

      await updateSubscription(subscription.id, {
        lastBillingDate: new Date(),
        nextBillingDate,
        totalPayments: subscription.totalPayments! + 1,
        failedPayments: 0, // Reset failure counter
      });

      // Send webhook
      await createWebhook({
        organizationId: subscription.organizationId,
        eventType: 'payment.succeeded',
        payload: {
          subscriptionId: subscription.id,
          paymentId: payment.id,
          planName: subscription.plan.name,
          userWallet: subscription.userWallet,
          amount: subscription.amount,
          txSignature,
          billingCycle: subscription.totalPayments! + 1,
        },
      });

      console.log(`✅ Recurring payment successful for subscription ${subscription.id}`);
      
      return { success: true, txSignature };

    } catch (error: any) {
      console.error(`❌ Recurring payment failed:`, error);

      // Update payment as failed
      await updateSubscriptionPayment(payment.id, {
        status: 'failed',
        errorMessage: error.message,
        retryCount: payment.retryCount! + 1,
      });

      // Update subscription failure counter
      const newFailedCount = subscription.failedPayments! + 1;
      const updates: any = {
        failedPayments: newFailedCount,
      };

      // Auto-pause after 3 failures
      if (newFailedCount >= 3) {
        updates.status = 'paused';
        
        await createWebhook({
          organizationId: subscription.organizationId,
          eventType: 'subscription.paused',
          payload: {
            subscriptionId: subscription.id,
            reason: 'Multiple payment failures',
            failedPayments: newFailedCount,
          },
        });
      }

      await updateSubscription(subscription.id, updates);

      return { success: false, error: error.message };
    }
  }

  /**
   * Process multiple subscriptions in batch
   */
  async batchProcessSubscriptions(
    subscriptions: Array<Subscription & { plan: SubscriptionPlan & { organization: any } }>
  ) {
    console.log(`🔄 Processing ${subscriptions.length} subscriptions`);

    const results = {
      successful: 0,
      failed: 0,
      total: subscriptions.length,
    };

    for (const subscription of subscriptions) {
      const result = await this.executeRecurringPayment(subscription);
      
      if (result.success) {
        results.successful++;
      } else {
        results.failed++;
      }

      // Small delay between transactions
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`✅ Batch complete: ${results.successful} successful, ${results.failed} failed`);

    return results;
  }
}
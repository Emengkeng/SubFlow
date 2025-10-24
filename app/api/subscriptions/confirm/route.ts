import { NextRequest, NextResponse } from 'next/server';
import {
  getSubscriptionById,
  updateSubscription,
  createWebhook,
} from '@/lib/db/payment-queries';
import { DelegationManager } from '@/lib/solana/delegation-manager';
import { SubscriptionPaymentExecutor } from '@/lib/solana/subscription-payment-executor';
import { SanctumGatewayClient } from '@/lib/solana/sanctum-gateway';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subscriptionId, signature } = body;

    if (!subscriptionId || !signature) {
      return NextResponse.json(
        { error: 'Missing required fields: subscriptionId, signature' },
        { status: 400 }
      );
    }

    // Get subscription
    const subscription = await getSubscriptionById(subscriptionId);
    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }

    if (subscription.status !== 'pending_approval') {
      return NextResponse.json(
        { error: 'Subscription is not pending approval' },
        { status: 400 }
      );
    }

    console.log('🔍 Verifying approval transaction:', signature);

    // Verify transaction was confirmed on-chain
    const gateway = new SanctumGatewayClient();
    const confirmed = await gateway.confirmTransaction(signature, 30);

    if (!confirmed) {
      return NextResponse.json(
        { error: 'Approval transaction not confirmed' },
        { status: 400 }
      );
    }

    console.log('✅ Approval transaction confirmed');

    // Verify delegation on-chain
    const delegationManager = new DelegationManager();
    const maxPayments = BigInt(subscription.plan.maxPayments || 12);
    const totalAllowance = BigInt(subscription.totalAmount) * maxPayments;
    
    const delegationVerified = await delegationManager.verifyApproval(
      subscription.userTokenAccount,
      subscription.delegateAuthority,
      totalAllowance
    );

    if (!delegationVerified) {
      return NextResponse.json(
        { error: 'Delegation verification failed. Please try again.' },
        { status: 400 }
      );
    }

    console.log('✅ Delegation verified on-chain');

    // Update subscription with approval
    await updateSubscription(subscriptionId, {
      approvalTxSignature: signature,
      delegationVerified: true,
      status: 'active',
    });

    console.log('🎉 Subscription activated!');

    // Reload subscription with updated status
    const updatedSubscription = await getSubscriptionById(subscriptionId);
    if (!updatedSubscription) {
      throw new Error('Failed to reload subscription');
    }

    // Process first payment IMMEDIATELY
    console.log('💰 Processing first payment...');
    
    const executor = new SubscriptionPaymentExecutor();
    const paymentResult = await executor.executeRecurringPayment(updatedSubscription);

    if (!paymentResult.success) {
      // First payment failed - mark subscription as failed
      await updateSubscription(subscriptionId, {
        status: 'paused',
        failedPayments: 1,
      });

      return NextResponse.json(
        { 
          error: 'First payment failed: ' + paymentResult.error,
          subscriptionId,
        },
        { status: 400 }
      );
    }

    console.log('✅ First payment successful:', paymentResult.txSignature);

    // Send subscription created webhook
    await createWebhook({
      organizationId: subscription.organizationId,
      eventType: 'subscription.created',
      payload: {
        subscriptionId: subscription.id,
        planName: subscription.plan.name,
        userWallet: subscription.userWallet,
        userEmail: subscription.userEmail,
        amount: subscription.amount,
        billingPeriodDays: subscription.plan.billingPeriodDays,
        nextBillingDate: subscription.nextBillingDate,
        firstPaymentTx: paymentResult.txSignature,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Subscription activated and first payment processed! 🎉',
      subscription: {
        id: subscription.id,
        status: 'active',
        planName: subscription.plan.name,
        nextBillingDate: subscription.nextBillingDate,
        amount: subscription.amount,
        displayAmount: `${(parseFloat(subscription.amount) / Math.pow(10, subscription.plan.tokenDecimals)).toFixed(2)}`,
      },
      firstPayment: {
        txSignature: paymentResult.txSignature,
        amount: subscription.totalAmount,
      },
    });
  } catch (error: any) {
    console.error('❌ Confirm subscription error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to confirm subscription' },
      { status: 500 }
    );
  }
}
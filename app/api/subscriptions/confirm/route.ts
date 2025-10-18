import { NextRequest, NextResponse } from 'next/server';
import { getSubscriptionById, updateSubscription } from '@/lib/db/subscription-queries';
import { DelegationManager } from '@/lib/solana/delegation-manager';
import { PaymentExecutor } from '@/lib/solana/payment-executor';
import { sendSubscriptionCreatedWebhook, sendPaymentSucceededWebhook } from '@/lib/webhooks/webhook-manager';

export async function POST(request: NextRequest) {
  try {
    const { subscriptionId, signature } = await request.json();

    if (!subscriptionId || !signature) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Fetch subscription
    const subscription = await getSubscriptionById(subscriptionId);
    if (!subscription || subscription.status !== 'pending_approval') {
      return NextResponse.json(
        { error: 'Subscription not found or already confirmed' },
        { status: 404 }
      );
    }

    // Verify approval on-chain
    const delegationManager = new DelegationManager();
    const isApproved = await delegationManager.verifyApproval(
      subscription.userTokenAccount,
      process.env.BACKEND_AUTHORITY!,
      BigInt(subscription.amountPerBilling)
    );

    if (!isApproved) {
      return NextResponse.json(
        {
          error: 'Approval verification failed',
          details: 'Transaction may not be confirmed yet. Please wait and try again.',
        },
        { status: 400 }
      );
    }

    // Execute immediate first payment
    const executor = await PaymentExecutor.create();
    let firstPayment;
    
    try {
      firstPayment = await executor.executePaymentWithRetry(subscription);
      console.log(`✅ First payment executed: ${firstPayment.txSignature}`);
    } catch (error: any) {
      console.error('First payment failed:', error);
      return NextResponse.json(
        {
          error: 'Failed to process initial payment',
          details: error.message,
        },
        { status: 400 }
      );
    }

    // Calculate next billing date (add billing period from now)
    const nextBillingDate = new Date();
    nextBillingDate.setDate(nextBillingDate.getDate() + subscription.plan.billingPeriodDays);

    // Activate subscription with updated billing date
    await updateSubscription(subscriptionId, {
      status: 'active',
      delegateSignature: signature,
      nextBillingDate,
      currentMonthSpent: subscription.amountPerBilling,
    });

    // Send webhooks
    await sendSubscriptionCreatedWebhook(subscription.plan.organizationId, subscription);
    await sendPaymentSucceededWebhook(subscription.plan.organizationId, firstPayment, subscription);

    return NextResponse.json({
      success: true,
      message: 'Subscription activated and first payment processed! 🎉',
      subscription: {
        id: subscriptionId,
        status: 'active',
        planName: subscription.plan.name,
        nextBillingDate: nextBillingDate,
        amount: subscription.amountPerBilling,
      },
      firstPayment: {
        id: firstPayment.id,
        txSignature: firstPayment.txSignature,
        amount: firstPayment.amount,
      },
    });
  } catch (error: any) {
    console.error('Checkout confirmation error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
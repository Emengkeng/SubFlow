import { NextRequest, NextResponse } from 'next/server';
import {
  getSubscriptionById,
  updateSubscription,
  createWebhook,
} from '@/lib/db/payment-queries';
import { DelegationManager } from '@/lib/solana/delegation-manager';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userWallet } = body;

    if (!userWallet) {
      return NextResponse.json(
        { error: 'Missing required field: userWallet' },
        { status: 400 }
      );
    }

    // Get subscription
    const subscription = await getSubscriptionById(id);
    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (subscription.userWallet !== userWallet) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Check if already cancelled
    if (subscription.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Subscription already cancelled' },
        { status: 400 }
      );
    }

    console.log('🛑 Cancelling subscription:', id);

    // Update subscription status
    await updateSubscription(id, {
      status: 'cancelled',
      cancelledAt: new Date(),
    });

    // Generate revocation transaction for user to sign
    const delegationManager = new DelegationManager();
    const revokeTransaction = await delegationManager.createRevocationTransaction(
      userWallet,
      subscription.plan.tokenMint
    );

    // Send webhook
    await createWebhook({
      organizationId: subscription.organizationId,
      eventType: 'subscription.cancelled',
      payload: {
        subscriptionId: subscription.id,
        planName: subscription.plan.name,
        userWallet: subscription.userWallet,
        cancelledAt: new Date(),
        totalPaymentsMade: subscription.totalPayments,
      },
    });

    console.log('✅ Subscription cancelled');

    return NextResponse.json({
      success: true,
      message: 'Subscription cancelled successfully',
      revokeTransaction,
      instructions: 'Sign and submit this transaction to complete cancellation and revoke delegation.',
      note: 'No further payments will be charged, even if you do not submit the revocation transaction.',
    });
  } catch (error: any) {
    console.error('❌ Cancel subscription error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
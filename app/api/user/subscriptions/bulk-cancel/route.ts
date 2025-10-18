// Cancel multiple subscriptions at once
import { NextRequest, NextResponse } from 'next/server';
import { bulkCancelSubscriptions } from '@/lib/db/subscription-queries';
import { DelegationManager } from '@/lib/solana/delegation-manager';
import { sendSubscriptionCancelledWebhook } from '@/lib/webhooks/webhook-manager';

export async function POST(request: NextRequest) {
  try {
    const { subscriptionIds, userWallet } = await request.json();

    if (!subscriptionIds || !Array.isArray(subscriptionIds) || subscriptionIds.length === 0) {
      return NextResponse.json(
        { error: 'Invalid subscription IDs' },
        { status: 400 }
      );
    }

    if (!userWallet) {
      return NextResponse.json(
        { error: 'Missing wallet address' },
        { status: 400 }
      );
    }

    // Bulk cancel
    const cancelled = await bulkCancelSubscriptions(subscriptionIds, userWallet);

    // Send webhooks for each cancelled subscription
    // Note: In production, We will consider queuing these
    for (const sub of cancelled) {
      await sendSubscriptionCancelledWebhook(sub.plan.organizationId, sub);
    }

    // Generate single revocation transaction for the user's token account
    // User only needs to sign once to revoke all delegations
    const delegationManager = new DelegationManager();
    
    // You may need to revoke for each unique token mint
    // For simplicity, assuming USDC for all
    const revokeTransaction = await delegationManager.createRevocationTransaction(
      userWallet,
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' // USDC mint
    );

    return NextResponse.json({
      success: true,
      message: `${cancelled.length} subscriptions cancelled`,
      cancelledCount: cancelled.length,
      revokeTransaction,
      instructions: 'Sign this transaction to revoke all delegations',
    });
  } catch (error: any) {
    console.error('Bulk cancel error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
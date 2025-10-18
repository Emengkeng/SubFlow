import { NextRequest, NextResponse } from 'next/server';
import { getSubscriptionById, updateSubscription } from '@/lib/db/subscription-queries';
import { DelegationManager } from '@/lib/solana/delegation-manager';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userWallet } = await request.json();

    // Verify ownership
    const subscription = await getSubscriptionById(params.id);
    if (!subscription || subscription.userWallet !== userWallet || subscription.status !== 'active') {
      return NextResponse.json(
        { error: 'Subscription not found or already cancelled' },
        { status: 404 }
      );
    }

    // Generate revocation transaction
    const delegationManager = new DelegationManager();
    const revokeTransaction = await delegationManager.createRevocationTransaction(
      userWallet,
      subscription.tokenMint
    );

    // Update status
    await updateSubscription(params.id, { status: 'cancelled' });

    return NextResponse.json({
      success: true,
      message: 'Subscription cancelled',
      revokeTransaction,
      instructions: 'Sign and submit this transaction to complete cancellation',
    });
  } catch (error: any) {
    console.error('Cancellation error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
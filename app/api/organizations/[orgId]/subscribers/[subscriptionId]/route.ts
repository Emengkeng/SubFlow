
// ============================================================================
// FILE: app/api/organizations/[orgId]/subscribers/[subscriptionId]/route.ts
// Get detailed info about a specific subscriber
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { 
  getSubscriptionById,
  getSubscriptionPayments 
} from '@/lib/db/payment-queries';
import { getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { teamMembers, teams } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

async function verifyOrgAccess(userId: number, orgId: string) {
  const access = await db
    .select()
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(
      and(
        eq(teamMembers.userId, userId),
        eq(teams.organizationId, orgId)
      )
    )
    .limit(1);

  return access.length > 0;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; subscriptionId: string }> }
) {
  try {
    const { orgId, subscriptionId } = await params;
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const hasAccess = await verifyOrgAccess(user.id, orgId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get subscription details
    const subscription = await getSubscriptionById(subscriptionId);
    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }

    // Verify subscription belongs to this organization
    if (subscription.organizationId !== orgId) {
      return NextResponse.json(
        { error: 'Subscription not found in this organization' },
        { status: 404 }
      );
    }

    // Get all payment history
    const payments = await getSubscriptionPayments(subscriptionId, 100);

    // Calculate detailed stats
    const totalPaid = payments
      .filter((p) => p.status === 'confirmed')
      .reduce((sum, p) => sum + parseFloat(p.amount), 0);

    const avgPaymentAmount = payments.length > 0
      ? totalPaid / payments.filter((p) => p.status === 'confirmed').length
      : 0;

    // Format response
    return NextResponse.json({
      success: true,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        userWallet: subscription.userWallet,
        userEmail: subscription.userEmail,
        
        // Plan details
        plan: {
          id: subscription.plan.id,
          name: subscription.plan.name,
          description: subscription.plan.description,
          amount: subscription.amount,
          displayAmount: `$${(parseFloat(subscription.amount) / Math.pow(10, subscription.plan.tokenDecimals)).toFixed(2)}`,
          billingPeriodDays: subscription.plan.billingPeriodDays,
        },
        
        // Billing info
        nextBillingDate: subscription.nextBillingDate,
        lastBillingDate: subscription.lastBillingDate,
        createdAt: subscription.createdAt,
        cancelledAt: subscription.cancelledAt,
        
        // Delegation info
        delegateAuthority: subscription.delegateAuthority,
        delegationVerified: subscription.delegationVerified,
        approvalTxSignature: subscription.approvalTxSignature,
        
        // Stats
        totalPayments: subscription.totalPayments,
        failedPayments: subscription.failedPayments,
        totalPaid: totalPaid.toString(),
        displayTotalPaid: `$${(totalPaid / 1_000_000).toFixed(2)}`,
        avgPaymentAmount: avgPaymentAmount.toString(),
        displayAvgPayment: `$${(avgPaymentAmount / 1_000_000).toFixed(2)}`,
      },
      paymentHistory: payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        displayAmount: `$${(parseFloat(p.amount) / Math.pow(10, subscription.plan.tokenDecimals)).toFixed(2)}`,
        status: p.status,
        txSignature: p.txSignature,
        deliveryMethod: p.deliveryMethod,
        retryCount: p.retryCount,
        errorMessage: p.errorMessage,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
      paymentStats: {
        successful: payments.filter((p) => p.status === 'confirmed').length,
        failed: payments.filter((p) => p.status === 'failed').length,
        pending: payments.filter((p) => p.status === 'pending').length,
        successRate: payments.length > 0
          ? ((payments.filter((p) => p.status === 'confirmed').length / payments.length) * 100).toFixed(2)
          : '0.00',
      },
    });
  } catch (error: any) {
    console.error('Get subscriber details error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
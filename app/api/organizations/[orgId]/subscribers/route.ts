// app/api/organizations/[orgId]/subscribers/route.ts
// Get all subscribers (subscriptions) for an organization

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { subscriptions, subscriptionPlans, subscriptionPayments, teamMembers, teams } from '@/lib/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { getUser } from '@/lib/db/queries';

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
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const hasAccess = await verifyOrgAccess(user.id, orgId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status'); // Filter by status
    const planId = searchParams.get('planId'); // Filter by specific plan
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build conditions
    const conditions = [eq(subscriptions.organizationId, orgId)];
    
    if (status) {
      conditions.push(eq(subscriptions.status, status));
    }
    
    if (planId) {
      conditions.push(eq(subscriptions.planId, planId));
    }

    // Get all subscriptions for this organization
    const orgSubscriptions = await db.query.subscriptions.findMany({
      where: conditions.length > 1 ? and(...conditions) : conditions[0],
      with: {
        plan: {
          columns: {
            id: true,
            name: true,
            amountPerBilling: true,
            billingPeriodDays: true,
            tokenDecimals: true,
          },
        },
        payments: {
          where: eq(subscriptionPayments.status, 'confirmed'),
          orderBy: [desc(subscriptionPayments.createdAt)],
          limit: 5, // Last 5 payments
        },
      },
      orderBy: [desc(subscriptions.createdAt)],
      limit,
      offset,
    });

    // Get total count for pagination
    const totalCountResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(subscriptions)
      .where(conditions.length > 1 ? and(...conditions) : conditions[0]);

    const totalCount = totalCountResult[0]?.count || 0;

    // Format response
    const formattedSubscribers = orgSubscriptions.map((sub) => ({
      subscriptionId: sub.id,
      userWallet: sub.userWallet,
      userEmail: sub.userEmail,
      status: sub.status,
      
      // Plan details
      planId: sub.plan.id,
      planName: sub.plan.name,
      amount: sub.amount,
      displayAmount: `$${(parseFloat(sub.amount) / Math.pow(10, sub.plan.tokenDecimals)).toFixed(2)}`,
      billingPeriod: `Every ${sub.plan.billingPeriodDays} days`,
      
      // Billing info
      nextBillingDate: sub.nextBillingDate,
      lastBillingDate: sub.lastBillingDate,
      createdAt: sub.createdAt,
      
      // Stats
      totalPayments: sub.totalPayments,
      failedPayments: sub.failedPayments,
      totalRevenue: sub.payments.reduce(
        (sum, p) => sum + parseFloat(p.amount),
        0
      ).toString(),
      
      // Recent payments
      recentPayments: sub.payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        txSignature: p.txSignature,
        status: p.status,
        createdAt: p.createdAt,
      })),
    }));

    // Calculate summary statistics
    const summaryStats = await db
      .select({
        totalActive: sql<number>`count(*) FILTER (WHERE ${subscriptions.status} = 'active')::int`,
        totalPaused: sql<number>`count(*) FILTER (WHERE ${subscriptions.status} = 'paused')::int`,
        totalCancelled: sql<number>`count(*) FILTER (WHERE ${subscriptions.status} = 'cancelled')::int`,
        monthlyRecurringRevenue: sql<string>`COALESCE(SUM(CASE WHEN ${subscriptions.status} = 'active' THEN ${subscriptions.amount} ELSE 0 END), 0)`,
      })
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, orgId));

    const stats = summaryStats[0] || {
      totalActive: 0,
      totalPaused: 0,
      totalCancelled: 0,
      monthlyRecurringRevenue: '0',
    };

    // Get revenue by plan
    const revenueByPlan = await db
      .select({
        planId: subscriptionPlans.id,
        planName: subscriptionPlans.name,
        activeSubscribers: sql<number>`count(*) FILTER (WHERE ${subscriptions.status} = 'active')::int`,
        monthlyRevenue: sql<string>`COALESCE(SUM(CASE WHEN ${subscriptions.status} = 'active' THEN ${subscriptions.amount} ELSE 0 END), 0)`,
      })
      .from(subscriptions)
      .innerJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
      .where(eq(subscriptions.organizationId, orgId))
      .groupBy(subscriptionPlans.id, subscriptionPlans.name);

    return NextResponse.json({
      success: true,
      subscribers: formattedSubscribers,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
      summary: {
        totalActive: stats.totalActive,
        totalPaused: stats.totalPaused,
        totalCancelled: stats.totalCancelled,
        totalSubscribers: stats.totalActive + stats.totalPaused,
        monthlyRecurringRevenue: stats.monthlyRecurringRevenue,
        displayMRR: `$${(parseFloat(stats.monthlyRecurringRevenue) / 1_000_000).toFixed(2)}`,
      },
      revenueByPlan: revenueByPlan.map((r) => ({
        ...r,
        displayRevenue: `$${(parseFloat(r.monthlyRevenue) / 1_000_000).toFixed(2)}`,
      })),
    });
  } catch (error: any) {
    console.error('Get subscribers error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
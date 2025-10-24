import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { 
  subscriptions, 
  subscriptionPlans, 
  subscriptionPayments,
  teamMembers,
  teams 
} from '@/lib/db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
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

    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '30');

    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Subscription status breakdown
    const statusBreakdown = await db
      .select({
        status: subscriptions.status,
        count: sql<number>`count(*)::int`,
        revenue: sql<string>`COALESCE(SUM(${subscriptions.amount}), 0)`,
      })
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, orgId))
      .groupBy(subscriptions.status);

    // New subscriptions over time
    const newSubscriptions = await db
      .select({
        date: sql<string>`DATE(${subscriptions.createdAt})`,
        count: sql<number>`count(*)::int`,
      })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.organizationId, orgId),
          gte(subscriptions.createdAt, startDate)
        )
      )
      .groupBy(sql`DATE(${subscriptions.createdAt})`)
      .orderBy(sql`DATE(${subscriptions.createdAt})`);

    // Revenue over time
    const revenueOverTime = await db
      .select({
        date: sql<string>`DATE(${subscriptionPayments.createdAt})`,
        revenue: sql<string>`COALESCE(SUM(${subscriptionPayments.amount}), 0)`,
        count: sql<number>`count(*)::int`,
      })
      .from(subscriptionPayments)
      .innerJoin(subscriptions, eq(subscriptionPayments.subscriptionId, subscriptions.id))
      .where(
        and(
          eq(subscriptions.organizationId, orgId),
          eq(subscriptionPayments.status, 'confirmed'),
          gte(subscriptionPayments.createdAt, startDate)
        )
      )
      .groupBy(sql`DATE(${subscriptionPayments.createdAt})`)
      .orderBy(sql`DATE(${subscriptionPayments.createdAt})`);

    // Churn analysis
    const churnData = await db
      .select({
        date: sql<string>`DATE(${subscriptions.cancelledAt})`,
        count: sql<number>`count(*)::int`,
      })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.organizationId, orgId),
          eq(subscriptions.status, 'cancelled'),
          gte(subscriptions.cancelledAt, startDate)
        )
      )
      .groupBy(sql`DATE(${subscriptions.cancelledAt})`)
      .orderBy(sql`DATE(${subscriptions.cancelledAt})`);

    // Top plans by subscribers
    const topPlans = await db
      .select({
        planId: subscriptionPlans.id,
        planName: subscriptionPlans.name,
        activeSubscribers: sql<number>`count(*) FILTER (WHERE ${subscriptions.status} = 'active')::int`,
        totalRevenue: sql<string>`COALESCE(SUM(${subscriptions.amount}) FILTER (WHERE ${subscriptions.status} = 'active'), 0)`,
      })
      .from(subscriptions)
      .innerJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
      .where(eq(subscriptions.organizationId, orgId))
      .groupBy(subscriptionPlans.id, subscriptionPlans.name)
      .orderBy(sql`count(*) FILTER (WHERE ${subscriptions.status} = 'active') DESC`)
      .limit(10);

    return NextResponse.json({
      success: true,
      period: `Last ${days} days`,
      statusBreakdown: statusBreakdown.map((s) => ({
        ...s,
        displayRevenue: `$${(parseFloat(s.revenue) / 1_000_000).toFixed(2)}`,
      })),
      newSubscriptions,
      revenueOverTime: revenueOverTime.map((r) => ({
        ...r,
        displayRevenue: `$${(parseFloat(r.revenue) / 1_000_000).toFixed(2)}`,
      })),
      churnData,
      topPlans: topPlans.map((p) => ({
        ...p,
        displayRevenue: `$${(parseFloat(p.totalRevenue) / 1_000_000).toFixed(2)}`,
      })),
    });
  } catch (error: any) {
    console.error('Get analytics error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';
import { 
  getOrganizationMetrics, 
  getPlatformRevenueByOrganization 
} from '@/lib/db/payment-queries';
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
  { params }: { params: { orgId: string } }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId } = params;

    // Verify user has access to this organization
    const hasAccess = await verifyOrgAccess(user.id, orgId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch metrics
    const metrics = await getOrganizationMetrics(orgId);
    
    // Optionally fetch revenue stats
    const revenueStats = await getPlatformRevenueByOrganization(orgId);

    return NextResponse.json({
      success: true,
      metrics: {
        products: metrics.products,
        payments: metrics.payments,
        revenueStats: {
          totalFees: revenueStats.totalFees,
          totalGasCosts: revenueStats.totalGasCosts,
          netRevenue: revenueStats.totalNetRevenue,
          transactionCount: revenueStats.transactionCount,
        },
      },
    });
  } catch (error: any) {
    console.error('Fetch organization metrics error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
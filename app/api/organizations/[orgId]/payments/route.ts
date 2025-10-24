import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';
import { getPaymentsByOrganization } from '@/lib/db/payment-queries';
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

const formatAmount = (amount: string, decimals = 6) => {
  const num = parseFloat(amount) / Math.pow(10, decimals);
  return `$${num.toFixed(2)}`;
};

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

    // Get query parameters for pagination
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    // Fetch payments with product and session details
    const paymentsData = await getPaymentsByOrganization(orgId, limit);

    // Transform payments to match frontend format
    const payments = paymentsData.map(payment => ({
      id: payment.id,
      productName: payment.product?.name || 'Unknown Product',
      customerWallet: payment.session?.customerWallet || 'N/A',
      amount: formatAmount(payment.totalAmount, payment.session?.tokenDecimals || 6),
      status: payment.status,
      txSignature: payment.txSignature,
      createdAt: payment.createdAt.toISOString(),
      // Additional fields that might be useful
      merchantAmount: formatAmount(payment.merchantAmount, payment.session?.tokenDecimals || 6),
      platformFee: formatAmount(payment.platformFee, payment.session?.tokenDecimals || 6),
      productId: payment.productId,
      sessionId: payment.sessionId,
    }));

    return NextResponse.json({
      success: true,
      payments,
      count: payments.length,
    });
  } catch (error: any) {
    console.error('Fetch payments error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
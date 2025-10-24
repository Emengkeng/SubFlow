import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';
import { getPlatformRevenueStats } from '@/lib/db/payment-queries';

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only allow owners/admins to view platform revenue
    if (user.role !== 'owner' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get period from query params (default 30 days)
    const { searchParams } = new URL(request.url);
    const periodDays = parseInt(searchParams.get('period') || '30');

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    // Fetch revenue stats
    const revenueData = await getPlatformRevenueStats(startDate, endDate);

    // Calculate derived metrics
    const totalFees = BigInt(revenueData.totalFees || '0');
    const totalGasCosts = BigInt(revenueData.totalGasCosts || '0');
    const netRevenue = BigInt(revenueData.totalNetRevenue || '0');
    const transactionCount = revenueData.transactionCount || 0;

    // Calculate profit margin (as percentage)
    const profitMargin = totalFees > 0n
      ? ((Number(netRevenue) / Number(totalFees)) * 100).toFixed(2) + '%'
      : '0%';

    // Calculate average gas cost per transaction (in lamports)
    const avgGasCostPerTx = transactionCount > 0
      ? (Number(totalGasCosts) / transactionCount).toFixed(0)
      : '0';

    // Check if platform is profitable
    const isProfitable = netRevenue > 0n;

    const stats = {
      totalFees: revenueData.totalFees,
      totalGasCosts: revenueData.totalGasCosts,
      netRevenue: revenueData.totalNetRevenue,
      transactionCount,
      profitMargin,
      avgGasCostPerTx,
      isProfitable,
    };

    return NextResponse.json({
      success: true,
      stats,
      period: {
        days: periodDays,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Fetch platform revenue error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
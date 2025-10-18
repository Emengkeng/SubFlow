import { NextRequest, NextResponse } from 'next/server';
import { getPlatformRevenueStats } from '@/lib/db/subscription-queries';
import { getUser } from '@/lib/db/queries';

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user || user.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30'; // days

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));
    const endDate = new Date();

    const stats = await getPlatformRevenueStats(startDate, endDate);

    // Calculate profitability
    const totalFees = BigInt(stats.totalFees);
    const totalGasCosts = BigInt(stats.totalGasCosts);
    const netRevenue = BigInt(stats.totalNetRevenue);
    const profitMargin = totalFees > 0 
      ? Number((netRevenue * BigInt(10000)) / totalFees) / 100 
      : 0;

    return NextResponse.json({
      success: true,
      period: `Last ${period} days`,
      stats: {
        totalFees: stats.totalFees,
        totalGasCosts: stats.totalGasCosts,
        netRevenue: stats.totalNetRevenue,
        transactionCount: stats.transactionCount,
        profitMargin: `${profitMargin.toFixed(2)}%`,
        avgGasCostPerTx: totalGasCosts > 0 
          ? (totalGasCosts / BigInt(stats.transactionCount)).toString()
          : '0',
        isProfitable: netRevenue > 0,
      },
    });
  } catch (error: any) {
    console.error('Platform revenue error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
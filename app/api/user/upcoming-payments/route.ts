// Get detailed upcoming payments view
import { NextRequest, NextResponse } from 'next/server';
import { getUpcomingPayments } from '@/lib/db/subscription-queries';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet');

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Missing wallet address' },
        { status: 400 }
      );
    }

    const upcomingPayments = await getUpcomingPayments(walletAddress);

    // Calculate totals
    const totalUpcoming = upcomingPayments.reduce(
      (sum, payment) => sum + BigInt(payment.amount),
      BigInt(0)
    );

    // Group by week
    const byWeek = upcomingPayments.reduce((acc, payment) => {
      const weekNumber = Math.ceil(payment.daysUntilDue / 7);
      const key = `Week ${weekNumber}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(payment);
      return acc;
    }, {} as Record<string, typeof upcomingPayments>);

    return NextResponse.json({
      success: true,
      upcomingPayments,
      totalUpcoming: totalUpcoming.toString(),
      groupedByWeek: byWeek,
      count: upcomingPayments.length,
    });
  } catch (error: any) {
    console.error('Upcoming payments error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
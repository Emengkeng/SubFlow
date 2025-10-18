import { NextRequest, NextResponse } from 'next/server';
import {
  getUserActiveSubscriptions,
  getUserSubscriptionStats,
  getUpcomingPayments,
  getUserMonthlyRecurringCost,
  getUserOrganizations,
} from '@/lib/db/subscription-queries';

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

    // Fetch all dashboard data in parallel for performance
    const [
      subscriptions,
      stats,
      upcomingPayments,
      monthlyRecurring,
      organizations,
    ] = await Promise.all([
      getUserActiveSubscriptions(walletAddress),
      getUserSubscriptionStats(walletAddress),
      getUpcomingPayments(walletAddress),
      getUserMonthlyRecurringCost(walletAddress),
      getUserOrganizations(walletAddress),
    ]);

    return NextResponse.json({
      success: true,
      dashboard: {
        subscriptions,
        stats,
        upcomingPayments,
        monthlyRecurring,
        organizations,
      },
    });
  } catch (error: any) {
    console.error('Dashboard error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
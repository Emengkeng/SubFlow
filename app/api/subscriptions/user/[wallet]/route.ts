import { NextRequest, NextResponse } from 'next/server';
import {
  getUserSubscriptions,
  getSubscriptionStats,
  getUpcomingPayments,
} from '@/lib/db/payment-queries';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ wallet: string }> }
) {
  try {
    const { wallet } = await params;

    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet address required' },
        { status: 400 }
      );
    }

    // Get all user's subscriptions
    const subscriptions = await getUserSubscriptions(wallet);

    // Get stats
    const stats = await getSubscriptionStats(wallet);

    // Get upcoming payments (next 30 days)
    const upcoming = await getUpcomingPayments(wallet, 30);

    // Format subscriptions
    const formattedSubscriptions = subscriptions.map((sub) => ({
      id: sub.id,
      status: sub.status,
      nextBillingDate: sub.nextBillingDate,
      lastBillingDate: sub.lastBillingDate,
      createdAt: sub.createdAt,
      amount: sub.amount,
      displayAmount: `$${(parseFloat(sub.amount) / Math.pow(10, sub.plan.tokenDecimals)).toFixed(2)}`,
      planName: sub.plan.name,
      planDescription: sub.plan.description,
      billingPeriodDays: sub.plan.billingPeriodDays,
      merchantName: sub.plan.organization.name,
      merchantLogo: sub.plan.organization.logoUrl,
      totalPayments: sub.totalPayments,
      failedPayments: sub.failedPayments,
      totalSpent: sub.payments.reduce(
        (sum, p) => sum + parseFloat(p.totalAmount),
        0
      ).toString(),
    }));

    // Format upcoming payments
    const formattedUpcoming = upcoming.map((sub) => ({
      subscriptionId: sub.id,
      organizationName: sub.plan.organization.name,
      organizationLogo: sub.plan.organization.logoUrl,
      planName: sub.plan.name,
      amount: sub.amount,
      displayAmount: `$${(parseFloat(sub.amount) / Math.pow(10, sub.plan.tokenDecimals)).toFixed(2)}`,
      dueDate: sub.nextBillingDate,
      daysUntilDue: Math.ceil(
        (new Date(sub.nextBillingDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      ),
    }));

    return NextResponse.json({
      success: true,
      subscriptions: formattedSubscriptions,
      stats: {
        ...stats,
        totalSpentDisplay: `$${(parseFloat(stats.totalSpent) / 1_000_000).toFixed(2)}`,
      },
      upcomingPayments: formattedUpcoming,
      count: subscriptions.length,
    });
  } catch (error: any) {
    console.error('Get user subscriptions error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
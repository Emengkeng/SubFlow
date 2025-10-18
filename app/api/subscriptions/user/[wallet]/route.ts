import { NextRequest, NextResponse } from 'next/server';
import { getSubscriptionsByWallet } from '@/lib/db/subscription-queries';

export async function GET(
  request: NextRequest,
  { params }: { params: { wallet: string } }
) {
  try {
    const subscriptions = await getSubscriptionsByWallet(params.wallet);

    // Format response
    const formatted = subscriptions.map((sub) => ({
      id: sub.id,
      status: sub.status,
      nextBillingDate: sub.nextBillingDate,
      createdAt: sub.createdAt,
      amount: sub.amountPerBilling,
      planName: sub.plan.name,
      planDescription: sub.plan.description,
      billingPeriodDays: sub.plan.billingPeriodDays,
      merchantName: sub.plan.organization.name,
      merchantLogo: sub.plan.organization.logoUrl,
      totalPayments: sub.payments.length,
      totalSpent: sub.payments
        .reduce((sum, p) => sum + BigInt(p.amount || '0'), BigInt(0))
        .toString(),
    }));

    return NextResponse.json({
      success: true,
      subscriptions: formatted,
    });
  } catch (error: any) {
    console.error('Fetch subscriptions error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
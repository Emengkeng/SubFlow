import { NextRequest, NextResponse } from 'next/server';
import { getSubscriptionPlanById } from '@/lib/db/payment-queries';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const plan = await getSubscriptionPlanById(id);
    if (!plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      plan: {
        ...plan,
        displayAmount: `$${(parseFloat(plan.amountPerBilling) / Math.pow(10, plan.tokenDecimals)).toFixed(2)}`,
        billingDescription: `Every ${plan.billingPeriodDays} days`,
      },
    });
  } catch (error: any) {
    console.error('Get plan error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
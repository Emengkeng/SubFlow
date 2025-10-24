import { NextRequest, NextResponse } from 'next/server';
import {
  getSubscriptionById,
  getSubscriptionPayments,
} from '@/lib/db/payment-queries';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify subscription exists
    const subscription = await getSubscriptionById(id);
    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }

    // Get payment history
    const payments = await getSubscriptionPayments(id, 50);

    // Format response
    const formattedPayments = payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      displayAmount: `$${(parseFloat(p.amount) / Math.pow(10, subscription.plan.tokenDecimals)).toFixed(2)}`,
      status: p.status,
      txSignature: p.txSignature,
      deliveryMethod: p.deliveryMethod,
      retryCount: p.retryCount,
      errorMessage: p.errorMessage,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    return NextResponse.json({
      success: true,
      subscriptionId: id,
      planName: subscription.plan.name,
      payments: formattedPayments,
      count: payments.length,
    });
  } catch (error: any) {
    console.error('Get subscription payments error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
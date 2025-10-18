import { NextRequest, NextResponse } from 'next/server';
import { getPaymentsBySubscription } from '@/lib/db/subscription-queries';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const payments = await getPaymentsBySubscription(params.id);

    return NextResponse.json({
      success: true,
      payments,
    });
  } catch (error: any) {
    console.error('Fetch payments error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
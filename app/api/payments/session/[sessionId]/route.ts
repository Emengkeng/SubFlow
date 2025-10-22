import { NextRequest, NextResponse } from 'next/server';
import { getPaymentSessionById } from '@/lib/db/payment-queries';

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await getPaymentSessionById(params.sessionId);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        status: session.status,
        amount: session.amount,
        totalAmount: session.totalAmount,
        displayTotal: `$${(parseFloat(session.totalAmount) / Math.pow(10, session.tokenDecimals)).toFixed(2)}`,
        txSignature: session.txSignature,
        confirmedAt: session.confirmedAt,
        expiresAt: session.expiresAt,
      },
    });
  } catch (error: any) {
    console.error('Get session error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
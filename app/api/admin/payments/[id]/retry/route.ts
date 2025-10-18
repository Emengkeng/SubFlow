import { NextRequest, NextResponse } from 'next/server';
import { updatePayment } from '@/lib/db/subscription-queries';
import { getUser } from '@/lib/db/queries';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUser();
    if (!user || user.role !== 'owner') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Reset payment to pending for retry
    await updatePayment(params.id, {
      status: 'pending',
      retryCount: 0,
      errorMessage: null,
    });

    return NextResponse.json({
      success: true,
      message: 'Payment queued for retry',
    });
  } catch (error: any) {
    console.error('Manual retry error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
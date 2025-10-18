import { NextRequest, NextResponse } from 'next/server';
import { getFailedPayments } from '@/lib/db/subscription-queries';
import { getUser } from '@/lib/db/queries';

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user || user.role !== 'owner') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const failedPayments = await getFailedPayments();

    return NextResponse.json({
      success: true,
      failedPayments,
    });
  } catch (error: any) {
    console.error('Failed payments error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
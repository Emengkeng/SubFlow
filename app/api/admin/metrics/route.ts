import { NextRequest, NextResponse } from 'next/server';
import { getSubscriptionMetrics } from '@/lib/db/subscription-queries';
import { getUser } from '@/lib/db/queries';

export async function GET(request: NextRequest) {
  try {
    // Verify admin user
    const user = await getUser();
    if (!user || user.role !== 'owner') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const metrics = await getSubscriptionMetrics();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      metrics,
    });
  } catch (error: any) {
    console.error('Metrics error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
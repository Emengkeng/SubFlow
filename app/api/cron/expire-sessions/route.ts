import { NextRequest, NextResponse } from 'next/server';
import { expireOldSessions } from '@/lib/db/payment-queries';

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await expireOldSessions();

    return NextResponse.json({
      success: true,
      message: 'Expired sessions cleaned up',
    });
  } catch (error: any) {
    console.error('Expire sessions error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Dev mode: allow GET
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return POST(request);
}
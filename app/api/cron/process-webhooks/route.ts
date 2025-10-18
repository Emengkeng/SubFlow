import { NextRequest, NextResponse } from 'next/server';
import { WebhookManager } from '@/lib/webhooks/webhook-manager';

// Verify cron secret
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (!cronSecret) {
    return true; // Allow in development
  }
  
  return authHeader === `Bearer ${cronSecret}`;
}

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    console.log('🔔 Processing pending webhooks...');
    
    const results = await WebhookManager.processPendingWebhooks();
    
    console.log(`
╔════════════════════════════════════════╗
║        WEBHOOK PROCESSOR               ║
╠════════════════════════════════════════╣
║ Processed:   ${results.processed.toString().padEnd(24)}║
║ Successful:  ${results.successful.toString().padEnd(24)}║
║ Failed:      ${results.failed.toString().padEnd(24)}║
╚════════════════════════════════════════╝
    `);

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error: any) {
    console.error('❌ Webhook processor error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// Optional GET for development
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'GET method not allowed in production' },
      { status: 405 }
    );
  }
  
  return POST(request);
}
// For merchants to test their webhook endpoint
import { NextRequest, NextResponse } from 'next/server';
import { WebhookManager } from '@/lib/webhooks/webhook-manager';
import { getOrganizationByApiKey } from '@/lib/db/subscription-queries';

export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key');
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing API key' },
        { status: 401 }
      );
    }

    const organization = await getOrganizationByApiKey(apiKey);
    if (!organization) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    // Send test webhook
    await WebhookManager.queueWebhook(
      organization.id,
      'test.webhook',
      {
        message: 'This is a test webhook',
        timestamp: new Date().toISOString(),
      }
    );

    // Process immediately
    await WebhookManager.processPendingWebhooks();

    return NextResponse.json({
      success: true,
      message: 'Test webhook sent to your configured URL',
    });
  } catch (error: any) {
    console.error('Test webhook error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
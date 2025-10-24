import { NextRequest, NextResponse } from 'next/server';
import { getOrganizationByApiKey } from '@/lib/db/payment-queries';
import { createHmac } from 'crypto';

function generateWebhookSignature(payload: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    // Get API key from header
    const apiKey = request.headers.get('X-API-Key');
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing API key' },
        { status: 401 }
      );
    }

    // Verify organization
    const organization = await getOrganizationByApiKey(apiKey);
    
    if (!organization) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    if (!organization.webhookUrl) {
      return NextResponse.json(
        { error: 'No webhook URL configured' },
        { status: 400 }
      );
    }

    // Create test webhook payload
    const testPayload = {
      event: 'payment.test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook from your payment system',
        organizationId: organization.id,
        organizationName: organization.name,
      },
    };

    const payloadString = JSON.stringify(testPayload);

    // Generate signature if webhook secret exists
    let signature = '';
    if (organization.webhookSecret) {
      signature = generateWebhookSignature(payloadString, organization.webhookSecret);
    }

    // Send test webhook
    const webhookResponse = await fetch(organization.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': 'payment.test',
        'User-Agent': 'PaymentSystem-Webhook/1.0',
      },
      body: payloadString,
    });

    const responseText = await webhookResponse.text();

    if (!webhookResponse.ok) {
      return NextResponse.json(
        {
          error: 'Webhook delivery failed',
          status: webhookResponse.status,
          statusText: webhookResponse.statusText,
          response: responseText.substring(0, 500), // Limit response size
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Test webhook sent successfully',
      webhookUrl: organization.webhookUrl,
      responseStatus: webhookResponse.status,
      responseBody: responseText.substring(0, 500),
    });
  } catch (error: any) {
    console.error('Webhook test error:', error);
    
    // Handle network errors
    if (error.cause?.code === 'ECONNREFUSED') {
      return NextResponse.json(
        { error: 'Connection refused. Could not reach webhook URL.' },
        { status: 400 }
      );
    }

    if (error.cause?.code === 'ENOTFOUND') {
      return NextResponse.json(
        { error: 'Webhook URL not found. Please check the URL.' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to send test webhook' },
      { status: 500 }
    );
  }
}
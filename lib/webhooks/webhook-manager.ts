import crypto from 'crypto';
import { createWebhook, getPendingWebhooks } from '@/lib/db/payment-queries';
import { db } from '@/lib/db/drizzle';
import { webhooks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

interface WebhookPayload {
  event: string;
  timestamp: string;
  data: any;
}

export class WebhookManager {
  /**
   * Generates HMAC signature for webhook payload
   */
  static generateSignature(payload: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  /**
   * Verifies HMAC signature (for merchants receiving webhooks)
   */
  static verifySignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    const expectedSignature = this.generateSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Queues a webhook for delivery
   */
  static async queueWebhook(
    organizationId: string,
    eventType: string,
    data: any
  ): Promise<void> {
    const payload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      data,
    };

    await createWebhook({
      organizationId,
      eventType,
      payload,
    });

    console.log(`📬 Webhook queued: ${eventType} for org ${organizationId}`);
  }

  /**
   * Delivers a single webhook with retry logic
   */
  static async deliverWebhook(webhook: any): Promise<boolean> {
    try {
      const organization = webhook.organization;
      
      if (!organization.webhookUrl) {
        console.log(`⚠️  No webhook URL for organization ${organization.id}`);
        await db
          .update(webhooks)
          .set({ status: 'failed', responseBody: 'No webhook URL configured' })
          .where(eq(webhooks.id, webhook.id));
        return false;
      }

      // Prepare payload
      const payloadString = JSON.stringify(webhook.payload);
      const signature = this.generateSignature(
        payloadString,
        organization.webhookSecret || 'default-secret'
      );

      // Send webhook
      const response = await fetch(organization.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': webhook.eventType,
          'X-Webhook-ID': webhook.id,
          'X-Webhook-Timestamp': webhook.payload.timestamp,
          'User-Agent': 'Sanctum-Subscriptions/1.0',
        },
        body: payloadString,
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      // Update webhook status
      if (response.ok) {
        await db
          .update(webhooks)
          .set({
            status: 'sent',
            responseStatus: response.status,
            responseBody: await response.text().catch(() => 'OK'),
            sentAt: new Date(),
          })
          .where(eq(webhooks.id, webhook.id));

        console.log(`✅ Webhook delivered: ${webhook.eventType} to ${organization.name}`);
        return true;
      } else {
        const errorBody = await response.text().catch(() => 'Unknown error');
        await db
          .update(webhooks)
          .set({
            status: 'failed',
            responseStatus: response.status,
            responseBody: errorBody,
            retryCount: (webhook.retryCount ?? 0) + 1,
          })
          .where(eq(webhooks.id, webhook.id));

        console.error(`❌ Webhook failed: ${response.status} - ${errorBody}`);
        return false;
      }
    } catch (error: any) {
      console.error(`❌ Webhook delivery error:`, error);
      
      await db
        .update(webhooks)
        .set({
          status: 'failed',
          responseBody: error.message,
          retryCount: (webhook.retryCount ?? 0) + 1,
        })
        .where(eq(webhooks.id, webhook.id));

      return false;
    }
  }

  /**
   * Processes pending webhooks in batch
   */
  static async processPendingWebhooks(): Promise<{
    processed: number;
    successful: number;
    failed: number;
  }> {
    const pendingWebhooks = await getPendingWebhooks(50);

    let successful = 0;
    let failed = 0;

    if (!pendingWebhooks || pendingWebhooks.length === 0) {
      return {
        processed: 0,
        successful,
        failed,
      };
    }

    for (const webhook of pendingWebhooks) {
      // Skip if too many retries
      if ((webhook.retryCount ?? 0) >= 5) {
        await db
          .update(webhooks)
          .set({ status: 'failed', responseBody: 'Max retries exceeded' })
          .where(eq(webhooks.id, webhook.id));
        failed++;
        continue;
      }

      const delivered = await this.deliverWebhook(webhook);
      if (delivered) {
        successful++;
      } else {
        failed++;
        // Re-queue for retry with exponential backoff
        // Next attempt will be picked up in future runs
      }

      // Small delay between deliveries to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return {
      processed: pendingWebhooks.length,
      successful,
      failed,
    };
  }
}

// ============================================================================
// WEBHOOK EVENT HELPERS
// ============================================================================

/**
 * Sends subscription.created webhook
 */
export async function sendSubscriptionCreatedWebhook(
  organizationId: string,
  subscription: any
) {
  await WebhookManager.queueWebhook(organizationId, 'subscription.created', {
    subscription: {
      id: subscription.id,
      userWallet: subscription.userWallet,
      planId: subscription.planId,
      status: subscription.status,
      amount: subscription.amount,
      nextBillingDate: subscription.nextBillingDate,
    },
  });
}

/**
 * Sends payment.succeeded webhook (for subscriptions)
 */
export async function sendPaymentSucceededWebhook(
  organizationId: string,
  payment: any,
  subscription: any
) {
  await WebhookManager.queueWebhook(organizationId, 'payment.succeeded', {
    payment: {
      id: payment.id,
      subscriptionId: payment.subscriptionId,
      amount: payment.amount,
      txSignature: payment.txSignature,
      status: payment.status,
    },
    subscription: {
      id: subscription.id,
      userWallet: subscription.userWallet,
    },
  });
}

/**
 * Sends payment.failed webhook
 */
export async function sendPaymentFailedWebhook(
  organizationId: string,
  payment: any,
  subscription: any,
  error: string
) {
  await WebhookManager.queueWebhook(organizationId, 'payment.failed', {
    payment: {
      id: payment.id,
      subscriptionId: payment.subscriptionId,
      amount: payment.amount,
      error,
    },
    subscription: {
      id: subscription.id,
      userWallet: subscription.userWallet,
      status: subscription.status,
    },
  });
}

/**
 * Sends subscription.cancelled webhook
 */
export async function sendSubscriptionCancelledWebhook(
  organizationId: string,
  subscription: any
) {
  await WebhookManager.queueWebhook(organizationId, 'subscription.cancelled', {
    subscription: {
      id: subscription.id,
      userWallet: subscription.userWallet,
      planId: subscription.planId,
      cancelledAt: new Date().toISOString(),
    },
  });
}

/**
 * Sends subscription.paused webhook
 */
export async function sendSubscriptionPausedWebhook(
  organizationId: string,
  subscription: any,
  reason: string
) {
  await WebhookManager.queueWebhook(organizationId, 'subscription.paused', {
    subscription: {
      id: subscription.id,
      userWallet: subscription.userWallet,
      planId: subscription.planId,
      reason,
    },
  });
}
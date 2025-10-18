import { NextRequest, NextResponse } from 'next/server';
import { PaymentExecutor } from '@/lib/solana/payment-executor';
import {
  getDueSubscriptions,
  checkPendingPayment,
  updateSubscription,
  resetMonthlySpending,
} from '@/lib/db/subscription-queries';

// Verify cron secret to prevent unauthorized access
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (!cronSecret) {
    return true; // Allow in development if no secret set
  }
  
  return authHeader === `Bearer ${cronSecret}`;
}

export async function POST(request: NextRequest) {
  // Verify authorization
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const startTime = Date.now();
  const metrics = {
    totalProcessed: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
  };

  try {
    console.log('🚀 Starting subscription processing...');

    // Reset monthly spending for subscriptions (run once per month)
    await resetMonthlySpending();

    // Get subscriptions due for payment
    const subscriptions = await getDueSubscriptions();
    console.log(`📋 Found ${subscriptions.length} subscriptions due for payment`);

    const executor = new PaymentExecutor();

    // Process each subscription
    for (const subscription of subscriptions) {
      metrics.totalProcessed++;

      try {
        // Check if already has pending payment
        const hasPending = await checkPendingPayment(subscription.id);
        if (hasPending) {
          console.log(`⏭️  Skipping ${subscription.id} - pending payment exists`);
          metrics.skipped++;
          continue;
        }

        // Validate subscription
        if (!validateSubscription(subscription)) {
          console.log(`⚠️  Subscription ${subscription.id} failed validation`);
          await updateSubscription(subscription.id, { status: 'paused' });
          metrics.skipped++;
          continue;
        }

        // Check monthly cap
        if (!checkMonthlyCap(subscription)) {
          console.log(`⚠️  Monthly cap reached for ${subscription.id}`);
          await updateSubscription(subscription.id, { status: 'paused' });
          metrics.skipped++;
          continue;
        }

        // Execute payment with retry logic
        await executor.executePaymentWithRetry(subscription);
        metrics.successful++;

        // Update next billing date
        const nextBillingDate = new Date(subscription.nextBillingDate);
        nextBillingDate.setDate(nextBillingDate.getDate() + subscription.plan.billingPeriodDays);
        
        const currentSpent = BigInt(subscription.currentMonthSpent || '0');
        const paymentAmount = BigInt(subscription.amountPerBilling);
        
        await updateSubscription(subscription.id, {
          nextBillingDate,
          currentMonthSpent: (currentSpent + paymentAmount).toString(),
        });

        console.log(`✅ Successfully processed ${subscription.id}`);
      } catch (error: any) {
        console.error(`❌ Failed to process ${subscription.id}:`, error.message);
        metrics.failed++;
      }
    }

    const duration = Date.now() - startTime;
    const successRate = metrics.totalProcessed > 0
      ? ((metrics.successful / metrics.totalProcessed) * 100).toFixed(2)
      : '0';

    console.log(`
╔════════════════════════════════════════╗
║        SCHEDULER RESULTS               ║
╠════════════════════════════════════════╣
║ Total Processed: ${metrics.totalProcessed.toString().padEnd(20)}║
║ Successful:      ${metrics.successful.toString().padEnd(20)}║
║ Failed:          ${metrics.failed.toString().padEnd(20)}║
║ Skipped:         ${metrics.skipped.toString().padEnd(20)}║
║ Success Rate:    ${successRate}%${' '.repeat(19 - successRate.length)}║
║ Duration:        ${duration}ms${' '.repeat(18 - duration.toString().length)}║
╚════════════════════════════════════════╝
    `);

    return NextResponse.json({
      success: true,
      metrics,
      duration,
      successRate: parseFloat(successRate),
    });
  } catch (error: any) {
    console.error('❌ Scheduler error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        metrics,
      },
      { status: 500 }
    );
  }
}

// Helper functions
function validateSubscription(subscription: any): boolean {
  // Check delegation expiry
  if (subscription.delegateExpiry && new Date(subscription.delegateExpiry) < new Date()) {
    return false;
  }

  return true;
}

function checkMonthlyCap(subscription: any): boolean {
  if (!subscription.monthlyCap) return true;

  const currentSpent = BigInt(subscription.currentMonthSpent || '0');
  const cap = BigInt(subscription.monthlyCap);
  const amount = BigInt(subscription.amountPerBilling);

  return currentSpent + amount <= cap;
}

// Optional GET endpoint for manual trigger (development only)
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'GET method not allowed in production' },
      { status: 405 }
    );
  }

  return POST(request);
}
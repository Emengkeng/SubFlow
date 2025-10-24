import { NextRequest, NextResponse } from 'next/server';
import { getDueSubscriptionsGroupedByOrg } from '@/lib/db/payment-queries';
import { SubscriptionPaymentExecutor } from '@/lib/solana/subscription-payment-executor';

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔄 Starting subscription payment processing...');
    const startTime = Date.now();

    // Get due subscriptions grouped by organization
    const groupedSubscriptions = await getDueSubscriptionsGroupedByOrg(1000);
    const totalSubscriptions = Object.values(groupedSubscriptions).reduce(
      (sum, subs) => sum + subs.length,
      0
    );

    console.log(`📊 Found ${totalSubscriptions} due subscriptions across ${Object.keys(groupedSubscriptions).length} organizations`);

    if (totalSubscriptions === 0) {
      return NextResponse.json({
        success: true,
        message: 'No subscriptions due for processing',
        metrics: {
          totalProcessed: 0,
          successful: 0,
          failed: 0,
          skipped: 0,
        },
      });
    }

    const executor = new SubscriptionPaymentExecutor();
    const allResults = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
    };

    // Process each organization's subscriptions
    for (const [orgId, subscriptions] of Object.entries(groupedSubscriptions)) {
      console.log(`\n🏢 Processing ${subscriptions.length} subscriptions for org: ${orgId}`);
      
      const result = await executor.batchProcessSubscriptions(subscriptions);
      
      allResults.totalProcessed += result.total;
      allResults.successful += result.successful;
      allResults.failed += result.failed;

      // Small delay between organizations
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const duration = Date.now() - startTime;
    const successRate = allResults.totalProcessed > 0 
      ? (allResults.successful / allResults.totalProcessed * 100).toFixed(2)
      : '0.00';

    console.log('\n✅ Subscription processing complete!');
    console.log(`📊 Results:`);
    console.log(`   - Total: ${allResults.totalProcessed}`);
    console.log(`   - Successful: ${allResults.successful}`);
    console.log(`   - Failed: ${allResults.failed}`);
    console.log(`   - Success Rate: ${successRate}%`);
    console.log(`   - Duration: ${(duration / 1000).toFixed(1)}s`);

    return NextResponse.json({
      success: true,
      metrics: allResults,
      duration,
      successRate: parseFloat(successRate),
    });
  } catch (error: any) {
    console.error('❌ Subscription processing error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// Allow GET in development for easy testing
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'development') {
    return POST(request);
  }
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
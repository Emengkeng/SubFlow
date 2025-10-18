// Search plans across all organizations
import { NextRequest, NextResponse } from 'next/server';
import { searchPlans } from '@/lib/db/subscription-queries';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const query = {
      search: searchParams.get('search') || undefined,
      organizationId: searchParams.get('orgId') || undefined,
      minAmount: searchParams.get('minAmount') || undefined,
      maxAmount: searchParams.get('maxAmount') || undefined,
      billingPeriod: searchParams.get('billingPeriod') 
        ? parseInt(searchParams.get('billingPeriod')!) 
        : undefined,
    };

    const plans = await searchPlans(query);

    return NextResponse.json({
      success: true,
      plans,
      count: plans.length,
    });
  } catch (error: any) {
    console.error('Search plans error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
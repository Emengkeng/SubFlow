// import { NextRequest, NextResponse } from 'next/server';
// import { searchSubscriptionPlans } from '@/lib/db/payment-queries';

// export async function GET(request: NextRequest) {
//   try {
//     const searchParams = request.nextUrl.searchParams;
//     const search = searchParams.get('search') || undefined;
//     const minAmount = searchParams.get('minAmount') || undefined;
//     const maxAmount = searchParams.get('maxAmount') || undefined;
//     const billingPeriod = searchParams.get('billingPeriod');

//     const plans = await searchSubscriptionPlans({
//       search,
//       minAmount,
//       maxAmount,
//       billingPeriod: billingPeriod ? parseInt(billingPeriod) : undefined,
//     });

//     const formattedPlans = plans.map((p) => ({
//       ...p,
//       displayAmount: `$${(parseFloat(p.amountPerBilling) / Math.pow(10, p.tokenDecimals)).toFixed(2)}`,
//       billingDescription: `Every ${p.billingPeriodDays} days`,
//     }));

//     return NextResponse.json({
//       success: true,
//       plans: formattedPlans,
//       count: plans.length,
//     });
//   } catch (error: any) {
//     console.error('Search plans error:', error);
//     return NextResponse.json(
//       { error: error.message },
//       { status: 500 }
//     );
//   }
// }
// import { NextRequest, NextResponse } from 'next/server';
// import {
//   createSubscriptionPlan,
//   getPlansByOrganization,
//   getOrganizationById,
// } from '@/lib/db/payment-queries';
// import { getUser } from '@/lib/db/queries';
// import { db } from '@/lib/db/drizzle';
// import { teamMembers, teams } from '@/lib/db/schema';
// import { eq, and } from 'drizzle-orm';

// async function verifyOrgAccess(userId: number, orgId: string) {
//   const access = await db
//     .select()
//     .from(teamMembers)
//     .innerJoin(teams, eq(teamMembers.teamId, teams.id))
//     .where(
//       and(
//         eq(teamMembers.userId, userId),
//         eq(teams.organizationId, orgId)
//       )
//     )
//     .limit(1);

//   return access.length > 0;
// }

// export async function POST(
//   request: NextRequest,
//   { params }: { params: Promise<{ orgId: string }> }
// ) {
//   try {
//     const { orgId } = await params;
//     const user = await getUser();
    
//     if (!user) {
//       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
//     }

//     const hasAccess = await verifyOrgAccess(user.id, orgId);
//     if (!hasAccess) {
//       return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
//     }

//     const body = await request.json();
//     const {
//       name,
//       description,
//       tokenMint,
//       amountPerBilling,
//       billingPeriodDays,
//       merchantTokenAccount,
//       tokenDecimals,
//       maxPayments,
//       monthlySpendingCap,
//       imageUrl,
//       metadata,
//     } = body;

//     if (!name || !tokenMint || !amountPerBilling || !billingPeriodDays || !merchantTokenAccount) {
//       return NextResponse.json(
//         { error: 'Missing required fields' },
//         { status: 400 }
//       );
//     }

//     const plan = await createSubscriptionPlan({
//       organizationId: orgId,
//       name,
//       description,
//       tokenMint,
//       amountPerBilling,
//       billingPeriodDays,
//       merchantTokenAccount,
//       tokenDecimals,
//       maxPayments,
//       monthlySpendingCap,
//       imageUrl,
//       metadata,
//     });

//     return NextResponse.json({
//       success: true,
//       plan: {
//         ...plan,
//         displayAmount: `$${(parseFloat(plan.amountPerBilling) / Math.pow(10, plan.tokenDecimals)).toFixed(2)}`,
//       },
//     });
//   } catch (error: any) {
//     console.error('Create plan error:', error);
//     return NextResponse.json(
//       { error: error.message },
//       { status: 500 }
//     );
//   }
// }

// export async function GET(
//   request: NextRequest,
//   { params }: { params: Promise<{ orgId: string }> }
// ) {
//   try {
//     const { orgId } = await params;
//     const user = await getUser();
    
//     if (!user) {
//       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
//     }

//     const hasAccess = await verifyOrgAccess(user.id, orgId);
//     if (!hasAccess) {
//       return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
//     }

//     const plans = await getPlansByOrganization(orgId);

//     const formattedPlans = plans.map((p) => ({
//       ...p,
//       displayAmount: `$${(parseFloat(p.amountPerBilling) / Math.pow(10, p.tokenDecimals)).toFixed(2)}`,
//     }));

//     return NextResponse.json({
//       success: true,
//       plans: formattedPlans,
//       count: plans.length,
//     });
//   } catch (error: any) {
//     console.error('Get plans error:', error);
//     return NextResponse.json(
//       { error: error.message },
//       { status: 500 }
//     );
//   }
// }
import { NextRequest, NextResponse } from 'next/server';
import { createPlan, getPlansByOrganization, getPlatformConfig } from '@/lib/db/subscription-queries';

export async function GET(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const paramsData = await params;
    const plans = await getPlansByOrganization(paramsData.orgId);

    return NextResponse.json({
      success: true,
      plans,
    });
  } catch (error: any) {
    console.error('Fetch plans error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const {
      name,
      description,
      tokenMint,
      amountPerBilling, // This is what merchant receives
      billingPeriodDays,
      merchantTokenAccount,
      tokenDecimals = 6,
    } = await request.json();

    // Get platform config for fee
    const paramsData = await params;
    const platformConfig = await getPlatformConfig();
    const platformFee = BigInt(platformConfig?.platformFeeAmount || '1000000');
    const merchantAmount = BigInt(amountPerBilling);
    const totalUserPays = merchantAmount + platformFee;

    const plan = await createPlan({
      organizationId: paramsData.orgId,
      name,
      description,
      tokenMint,
      amountPerBilling: totalUserPays.toString(), // Store total amount
      billingPeriodDays,
      merchantTokenAccount,
      tokenDecimals,
    });

    return NextResponse.json({
      success: true,
      plan,
      breakdown: {
        merchantReceives: merchantAmount.toString(),
        platformFee: platformFee.toString(),
        userPays: totalUserPays.toString(),
        note: 'User pays merchant amount + 1 USDC platform fee. Platform sponsors all gas costs.',
      },
    });
  } catch (error: any) {
    console.error('Plan creation error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
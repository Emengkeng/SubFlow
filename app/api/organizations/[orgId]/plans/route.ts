import { NextRequest, NextResponse } from 'next/server';
import { 
  createPlan, 
  getPlansByOrganization, 
  getPlatformConfig,
  getPlanById,
  updatePlan,
  deletePlan,
  checkPlanHasActiveSubscriptions
} from '@/lib/db/subscription-queries';

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

    // Validation
    if (!name || !tokenMint || !amountPerBilling || !billingPeriodDays || !merchantTokenAccount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get platform config for fee
    const alltokenDecimals = 6;
    const paramsData = await params;
    const platformConfig = await getPlatformConfig();
    const platformFee = BigInt(platformConfig?.platformFeeAmount || '1000000');
    const formatamountPerBilling = parseFloat(amountPerBilling) * Math.pow(10, alltokenDecimals);
    const merchantAmount = BigInt(formatamountPerBilling);
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const paramsData = await params;
    const body = await request.json();
    const { planId, name, description, isActive } = body;

    if (!planId) {
      return NextResponse.json(
        { error: 'Plan ID is required' },
        { status: 400 }
      );
    }

    // Verify plan belongs to this organization
    const existingPlan = await getPlanById(planId);
    if (!existingPlan || existingPlan.organizationId !== paramsData.orgId) {
      return NextResponse.json(
        { error: 'Plan not found or access denied' },
        { status: 404 }
      );
    }

    // Check if plan has active subscriptions
    const hasActiveSubscriptions = await checkPlanHasActiveSubscriptions(planId);

    // Only allow editing name, description, and isActive status
    // Financial details (amount, billing period) cannot be changed if there are active subscriptions
    const updateData: any = {};
    
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined) {
      if (hasActiveSubscriptions && !isActive) {
        return NextResponse.json(
          { 
            error: 'Cannot deactivate plan with active subscriptions. Cancel all subscriptions first.',
            activeSubscriptions: true
          },
          { status: 400 }
        );
      }
      updateData.isActive = isActive;
    }

    const updatedPlan = await updatePlan(planId, updateData);

    return NextResponse.json({
      success: true,
      plan: updatedPlan,
      message: 'Plan updated successfully',
      note: hasActiveSubscriptions 
        ? 'Only name, description, and status can be edited for plans with active subscriptions'
        : 'Plan updated. No active subscriptions found.',
    });
  } catch (error: any) {
    console.error('Plan update error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const paramsData = await params;
    const { searchParams } = new URL(request.url);
    const planId = searchParams.get('planId');

    if (!planId) {
      return NextResponse.json(
        { error: 'Plan ID is required' },
        { status: 400 }
      );
    }

    // Verify plan belongs to this organization
    const existingPlan = await getPlanById(planId);
    if (!existingPlan || existingPlan.organizationId !== paramsData.orgId) {
      return NextResponse.json(
        { error: 'Plan not found or access denied' },
        { status: 404 }
      );
    }

    // Check if plan has active subscriptions
    const hasActiveSubscriptions = await checkPlanHasActiveSubscriptions(planId);
    
    if (hasActiveSubscriptions) {
      return NextResponse.json(
        { 
          error: 'Cannot delete plan with active subscriptions. Please cancel all subscriptions first or deactivate the plan.',
          activeSubscriptions: true
        },
        { status: 400 }
      );
    }

    // Soft delete by setting isActive to false
    await deletePlan(planId);

    return NextResponse.json({
      success: true,
      message: 'Plan deleted successfully',
    });
  } catch (error: any) {
    console.error('Plan deletion error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
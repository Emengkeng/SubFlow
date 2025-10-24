import { NextRequest, NextResponse } from 'next/server';
import {
  getSubscriptionPlanById,
  createSubscription,
  hasActiveSubscription,
  getPlatformConfig,
} from '@/lib/db/payment-queries';
import { DelegationManager } from '@/lib/solana/delegation-manager';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { planId, userWallet, email } = body;

    if (!planId || !userWallet) {
      return NextResponse.json(
        { error: 'Missing required fields: planId, userWallet' },
        { status: 400 }
      );
    }

    // Get plan
    const plan = await getSubscriptionPlanById(planId);
    if (!plan || !plan.isActive) {
      return NextResponse.json(
        { error: 'Plan not found or inactive' },
        { status: 404 }
      );
    }

    // Check for existing active subscription
    const hasActive = await hasActiveSubscription(planId, userWallet);
    if (hasActive) {
      return NextResponse.json(
        { error: 'You already have an active subscription to this plan' },
        { status: 400 }
      );
    }

    // Get platform config
    const platformConfig = await getPlatformConfig();
    if (!platformConfig) {
      return NextResponse.json(
        { error: 'Platform config not found' },
        { status: 500 }
      );
    }

    // Calculate amounts
    const amount = BigInt(plan.amountPerBilling);
    const platformFee = BigInt(platformConfig.platformFeeAmount);
    const totalAmount = amount + platformFee;

    // Get user's token account address
    const delegationManager = new DelegationManager();
    const userTokenAccount = await delegationManager.getTokenAccountAddress(
      userWallet,
      plan.tokenMint
    );

    // Calculate next billing date (immediate first payment)
    const nextBillingDate = new Date();
    nextBillingDate.setDate(nextBillingDate.getDate() + plan.billingPeriodDays);

    // Create subscription record
    const subscription = await createSubscription({
      planId: plan.id,
      organizationId: plan.organizationId,
      userWallet,
      userEmail: email,
      userTokenAccount,
      delegateAuthority: process.env.BACKEND_AUTHORITY!,
      amount: amount.toString(),
      platformFee: platformFee.toString(),
      totalAmount: totalAmount.toString(),
      nextBillingDate,
    });

    console.log('📝 Subscription created:', subscription.id);

    // Generate approval transaction for user to sign
    const approvalResponse = await delegationManager.createApprovalTransaction({
      userWallet,
      tokenMint: plan.tokenMint,
      amount: plan.amountPerBilling,
      billingPeriodDays: plan.billingPeriodDays,
      maxPayments: plan.maxPayments || 12,
    });

    console.log('✅ Approval transaction generated');

    return NextResponse.json({
      success: true,
      subscriptionId: subscription.id,
      plan: {
        name: plan.name,
        description: plan.description,
        amount: plan.amountPerBilling,
        displayAmount: `$${(parseFloat(plan.amountPerBilling) / Math.pow(10, plan.tokenDecimals)).toFixed(2)}`,
        billingPeriod: `Every ${plan.billingPeriodDays} days`,
        merchant: plan.organization.name,
        merchantLogo: plan.organization.logoUrl,
      },
      approval: {
        transaction: approvalResponse.approvalTransaction,
        delegateAuthority: approvalResponse.delegateAuthority,
        totalAllowance: approvalResponse.totalAllowance,
        expiryDate: approvalResponse.expiryDate,
        instructions: approvalResponse.instructionsForUser,
      },
      notice: 'You will be charged immediately upon approval, then every billing period thereafter.',
    });
  } catch (error: any) {
    console.error('❌ Initiate subscription error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to initiate subscription' },
      { status: 500 }
    );
  }
}
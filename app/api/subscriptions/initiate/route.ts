import { NextRequest, NextResponse } from 'next/server';
import { getPlanById, createSubscription, getSubscriptionsByWallet, getPlatformConfig } from '@/lib/db/subscription-queries';
import { DelegationManager } from '@/lib/solana/delegation-manager';

export async function POST(request: NextRequest) {
  try {
    const { planId, userWallet, email } = await request.json();

    if (!planId || !userWallet) {
      return NextResponse.json(
        { error: 'Missing required fields: planId, userWallet' },
        { status: 400 }
      );
    }

    // Fetch plan details
    const plan = await getPlanById(planId);
    const platformConfig = await getPlatformConfig();
    const platformFee = BigInt(platformConfig?.platformFeeAmount || '1000000');
    if (!plan) {
      return NextResponse.json(
        { error: 'Plan not found or inactive' },
        { status: 404 }
      );
    }

    // Plan amount already includes platform fee
    const totalAmount = BigInt(plan.amountPerBilling);
    const merchantAmount = totalAmount - platformFee;

    // Check for existing active subscription
    const existingSubs = await getSubscriptionsByWallet(userWallet);
    const hasActive = existingSubs.some(
      (sub) => sub.planId === planId && ['active', 'pending_approval'].includes(sub.status)
    );

    if (hasActive) {
      return NextResponse.json(
        { error: 'Active subscription already exists for this plan' },
        { status: 400 }
      );
    }

    // Create approval transaction
    const delegationManager = new DelegationManager();
    const approval = await delegationManager.createApprovalTransaction({
      userWallet,
      tokenMint: plan.tokenMint,
      amount: plan.amountPerBilling,
      billingPeriodDays: plan.billingPeriodDays,
      maxPayments: 12,
    });

    // Create pending subscription
    // Note: nextBillingDate will be set properly after first payment in confirm endpoint
    const nextBillingDate = new Date();
    nextBillingDate.setDate(nextBillingDate.getDate() + plan.billingPeriodDays);

    const subscription = await createSubscription({
      planId: plan.id,
      userWallet,
      userTokenAccount: approval.tokenAccount,
      merchantTokenAccount: plan.merchantTokenAccount,
      tokenMint: plan.tokenMint,
      tokenDecimals: plan.tokenDecimals,
      amountPerBilling: plan.amountPerBilling,
      nextBillingDate, // Temporary, will be updated on confirm
    });

    return NextResponse.json({
      success: true,
      subscriptionId: subscription.id,
      plan: {
        name: plan.name,
        description: plan.description,
        amount: plan.amountPerBilling,
        billingPeriod: `Every ${plan.billingPeriodDays} days`,
        merchant: plan.organization.name,
      },
       priceBreakdown: {
        merchantAmount: merchantAmount.toString(),
        platformFee: platformFee.toString(),
        totalAmount: totalAmount.toString(),
        note: '✅ Platform sponsors all transaction fees',
      },
      approval: {
        transaction: approval.approvalTransaction,
        delegateAuthority: approval.delegateAuthority,
        totalAllowance: approval.totalAllowance,
        expiryDate: approval.expiryDate,
        instructions: approval.instructionsForUser,
      },
      notice: 'You will be charged immediately upon approval, then every billing period thereafter.',
    });
  } catch (error: any) {
    console.error('Checkout initiation error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
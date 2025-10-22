import { NextRequest, NextResponse } from 'next/server';
import {
  getProductById,
  createPaymentSession,
  getPlatformConfig,
} from '@/lib/db/payment-queries';
import { PaymentExecutor } from '@/lib/solana/payment-executor';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, customerWallet, customerEmail, metadata } = body;

    if (!productId || !customerWallet) {
      return NextResponse.json(
        { error: 'Missing required fields: productId, customerWallet' },
        { status: 400 }
      );
    }

    // Get product
    const product = await getProductById(productId);
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Get platform config
    const platformConfig = await getPlatformConfig();
    if (!platformConfig) {
      return NextResponse.json({ error: 'Platform config not found' }, { status: 500 });
    }

    // Calculate amounts
    const amount = BigInt(product.price);
    const platformFee = BigInt(platformConfig.platformFeeAmount);
    const totalAmount = amount + platformFee;

    // Create session (expires in 30 minutes)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 30);

    const session = await createPaymentSession({
      productId: product.id,
      organizationId: product.organizationId,
      customerWallet,
      customerEmail,
      amount: amount.toString(),
      platformFee: platformFee.toString(),
      totalAmount: totalAmount.toString(),
      tokenMint: product.tokenMint,
      tokenDecimals: product.tokenDecimals,
      merchantWallet: product.merchantWallet,
      expiresAt,
      metadata,
    });

    // Generate transaction for customer to sign
    const executor = await PaymentExecutor.create();
    const { payment } = await executor.executeDirectPayment(
      { ...session, product },
      customerWallet,
      customerWallet // Token account - will be derived in executor
    );

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        productId: product.id,
        productName: product.name,
        amount: session.amount,
        platformFee: session.platformFee,
        totalAmount: session.totalAmount,
        displayTotal: `$${(parseFloat(session.totalAmount) / Math.pow(10, session.tokenDecimals)).toFixed(2)}`,
        expiresAt: session.expiresAt,
        status: session.status,
      },
      transaction: payment.transaction,
    });
  } catch (error: any) {
    console.error('Create session error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
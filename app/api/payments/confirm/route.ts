import { NextRequest, NextResponse } from 'next/server';
import {
  getPaymentSessionById,
  updatePaymentSession,
  createPayment,
  updatePayment,
  createPlatformRevenue,
  getPlatformConfig,
  createWebhook,
} from '@/lib/db/payment-queries';
import { SanctumGatewayClient } from '@/lib/solana/sanctum-gateway';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, txSignature } = body;

    if (!sessionId || !txSignature) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, txSignature' },
        { status: 400 }
      );
    }

    // Get session
    const session = await getPaymentSessionById(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.status === 'completed') {
      return NextResponse.json({ error: 'Session already completed' }, { status: 409 });
    }

    if (session.status === 'expired') {
      return NextResponse.json({ error: 'Session expired' }, { status: 410 });
    }

    // Verify transaction on-chain
    const gateway = new SanctumGatewayClient();
    const confirmed = await gateway.confirmTransaction(txSignature, 30);

    if (!confirmed) {
      return NextResponse.json(
        { error: 'Transaction not confirmed' },
        { status: 400 }
      );
    }

    // Create payment record
    const payment = await createPayment({
      sessionId: session.id,
      productId: session.productId,
      organizationId: session.organizationId,
      merchantAmount: session.amount,
      platformFee: session.platformFee,
      totalAmount: session.totalAmount,
      gasCost: '0', // Customer paid gas
      txSignature,
      deliveryMethod: 'customer_signed',
    });

    // Update payment status
    await updatePayment(payment.id, {
      status: 'confirmed',
      slotConfirmed: Date.now(),
    });

    // Update session
    await updatePaymentSession(sessionId, {
      status: 'completed',
      txSignature,
      confirmedAt: new Date(),
    });

    // Record platform revenue
    const platformConfig = await getPlatformConfig();
    if (platformConfig) {
      await createPlatformRevenue({
        paymentId: payment.id,
        organizationId: session.organizationId,
        feeAmount: session.platformFee,
        merchantAmount: session.amount,
        totalAmount: session.totalAmount,
        gasCost: '0',
        txSignature,
      });
    }

    // Send webhook
    await createWebhook({
      organizationId: session.organizationId,
      eventType: 'payment.succeeded',
      payload: {
        paymentId: payment.id,
        sessionId: session.id,
        productId: session.productId,
        productName: session.product.name,
        customerWallet: session.customerWallet,
        customerEmail: session.customerEmail,
        amount: session.amount,
        displayAmount: `$${(parseFloat(session.amount) / Math.pow(10, session.tokenDecimals)).toFixed(2)}`,
        txSignature,
        metadata: session.metadata,
      },
    });

    return NextResponse.json({
      success: true,
      payment: {
        id: payment.id,
        sessionId: session.id,
        status: 'confirmed',
        txSignature,
        merchantAmount: session.amount,
        platformFee: session.platformFee,
        totalAmount: session.totalAmount,
        confirmedAt: new Date(),
      },
      message: 'Payment confirmed successfully',
    });
  } catch (error: any) {
    console.error('Confirm payment error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
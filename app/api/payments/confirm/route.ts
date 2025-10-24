import { NextRequest, NextResponse } from 'next/server';
import { 
  createPurchase, 
  getPaymentSessionById,
  updatePaymentSession 
} from '@/lib/db/payment-queries';
import { PaymentExecutor } from '@/lib/solana/payment-executor';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, txSignature } = body;

    if (!sessionId || !txSignature) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get session
    const session = await getPaymentSessionById(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Confirm payment on-chain
    const executor = await PaymentExecutor.create();
    const { confirmed, payment } = await executor.confirmPayment(sessionId, txSignature);

    if (!confirmed) {
      return NextResponse.json(
        { error: 'Payment confirmation failed' },
        { status: 400 }
      );
    }

    // Create purchase record for digital product
    const purchase = await createPurchase({
      productId: session.productId,
      sessionId: session.id,
      paymentId: payment.id,
      organizationId: session.organizationId,
      customerWallet: session.customerWallet!,
      customerEmail: session.customerEmail,
      pricePaid: session.totalAmount,
      txSignature,
      maxDownloads: session.product.downloadLimit || 5,
      metadata: session.metadata,
    });

    // Update session status
    await updatePaymentSession(sessionId, {
      status: 'completed',
      txSignature,
      confirmedAt: new Date(),
    });

    console.log('✅ Purchase created:', purchase.id);

    return NextResponse.json({
      success: true,
      payment,
      purchase: {
        id: purchase.id,
        productId: purchase.productId,
        downloadCount: purchase.downloadCount,
        maxDownloads: purchase.maxDownloads,
      },
    });
  } catch (error: any) {
    console.error('Payment confirmation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
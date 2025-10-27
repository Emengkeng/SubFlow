import { NextRequest, NextResponse } from 'next/server';
import { getPaymentSessionById } from '@/lib/db/payment-queries';
import { SanctumGatewayClient } from '@/lib/solana/sanctum-gateway';
import { VersionedTransaction } from '@solana/web3.js';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, signedTransaction } = body;

    if (!sessionId || !signedTransaction) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify session exists
    const session = await getPaymentSessionById(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.status === 'completed') {
      return NextResponse.json({ error: 'Session already completed' }, { status: 400 });
    }

    // Deserialize signed transaction
    const txBuffer = Buffer.from(signedTransaction, 'base64');
    const transaction = VersionedTransaction.deserialize(txBuffer);

    console.log('📤 Sending transaction via Sanctum Gateway...');
    
    // ============================================================
    // KEY: Use Sanctum Gateway's sendTransaction for delivery
    // ============================================================
    const gateway = new SanctumGatewayClient();
    const result = await gateway.sendTransaction(transaction.serialize());

    console.log('✅ Transaction sent via Gateway:');
    console.log('   - Signature:', result.signature);
    console.log('   - Delivery Method:', result.deliveryMethod);
    console.log('   - Slot:', result.slot);

    return NextResponse.json({
      success: true,
      signature: result.signature,
      deliveryMethod: result.deliveryMethod,
      slot: result.slot,
    });

  } catch (error: any) {
    console.error('❌ Send transaction error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to send transaction' 
    }, { status: 500 });
  }
}
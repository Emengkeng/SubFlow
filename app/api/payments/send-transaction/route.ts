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
        { error: 'Missing required fields: sessionId, signedTransaction' },
        { status: 400 }
      );
    }

    // Verify session exists and is valid
    const session = await getPaymentSessionById(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.status === 'completed') {
      return NextResponse.json({ 
        error: 'Session already completed' 
      }, { status: 400 });
    }

    // Check if session has expired
    if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
      return NextResponse.json({ 
        error: 'Session has expired' 
      }, { status: 400 });
    }

    // Deserialize signed transaction
    const txBuffer = Buffer.from(signedTransaction, 'base64');

    console.log('📤 Sending transaction via Sanctum Gateway...');
    console.log('   Session ID:', sessionId);
    console.log('   Transaction size:', txBuffer.length, 'bytes');
    
    const gateway = new SanctumGatewayClient();
    const result = await gateway.sendTransaction(txBuffer);

    console.log('✅ Transaction sent via Sanctum Gateway:');
    console.log('   Signature:', result.signature);
    // console.log('   Delivery Method:', result.deliveryMethod);
    // console.log('   Slot:', result.slot || 'N/A');

    return NextResponse.json({
      success: true,
      signature: result.signature,
    //   deliveryMethod: result.deliveryMethod,
    //   slot: result.slot,
      message: 'Transaction sent successfully via Sanctum Gateway',
    });

  } catch (error: any) {
    console.error('❌ Send transaction error:', error);
    
    // Parse error message for better user feedback
    let errorMessage = error.message || 'Failed to send transaction';
    
    if (errorMessage.includes('insufficient funds')) {
      errorMessage = 'Insufficient balance in your wallet';
    } else if (errorMessage.includes('blockhash not found')) {
      errorMessage = 'Transaction expired. Please try again';
    } else if (errorMessage.includes('already processed')) {
      errorMessage = 'Transaction already processed';
    }
    
    return NextResponse.json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    }, { status: 500 });
  }
}
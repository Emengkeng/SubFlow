import { NextRequest, NextResponse } from 'next/server';
import {
  getPaymentsByOrganization,
  getOrganizationByApiKey,
} from '@/lib/db/payment-queries';

export async function GET(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return NextResponse.json({ error: 'API key required' }, { status: 401 });
    }

    const organization = await getOrganizationByApiKey(apiKey);
    if (!organization) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50');

    const payments = await getPaymentsByOrganization(organization.id, limit);

    // Calculate totals
    const totals = payments.reduce(
      (acc, p) => {
        if (p.status === 'confirmed') {
          acc.confirmed++;
          acc.revenue += parseFloat(p.merchantAmount);
        } else if (p.status === 'pending') {
          acc.pending++;
        } else if (p.status === 'failed') {
          acc.failed++;
        }
        return acc;
      },
      { confirmed: 0, pending: 0, failed: 0, revenue: 0 }
    );

    return NextResponse.json({
      success: true,
      payments: payments.map((p) => ({
        id: p.id,
        productName: p.product.name,
        customerWallet: p.session?.customerWallet,
        amount: p.totalAmount,
        displayAmount: `$${(parseFloat(p.totalAmount) / Math.pow(10, 6)).toFixed(2)}`,
        status: p.status,
        txSignature: p.txSignature,
        createdAt: p.createdAt,
      })),
      total: {
        confirmed: totals.confirmed,
        pending: totals.pending,
        failed: totals.failed,
        revenue: `$${(totals.revenue / 1_000_000).toFixed(2)}`,
      },
    });
  } catch (error: any) {
    console.error('Get payment history error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
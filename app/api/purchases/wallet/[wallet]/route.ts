
import { NextRequest, NextResponse } from 'next/server';
import { getPurchasesByWallet } from '@/lib/db/payment-queries';

export async function GET(
  request: NextRequest,
  { params }: { params: { wallet: string } }
) {
  try {
    const { wallet } = await params;

    const purchases = await getPurchasesByWallet(wallet);

    return NextResponse.json({
      success: true,
      purchases: purchases.map(purchase => ({
        id: purchase.id,
        product: {
          id: purchase.product.id,
          name: purchase.product.name,
          description: purchase.product.description,
          imageUrl: purchase.product.imageUrl,
          fileType: purchase.product.fileType,
          fileSize: purchase.product.fileSize,
        },
        organization: purchase.product.organization,
        pricePaid: purchase.pricePaid,
        txSignature: purchase.txSignature,
        downloadCount: purchase.downloadCount,
        maxDownloads: purchase.maxDownloads,
        lastDownloadAt: purchase.lastDownloadAt,
        createdAt: purchase.createdAt,
        canDownload: purchase.downloadCount! < purchase.maxDownloads,
      })),
    });
  } catch (error: any) {
    console.error('Get purchases error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { 
  getPurchaseById, 
  createDownloadLink,
  getActiveDownloadLink,
  incrementDownloadCount
} from '@/lib/db/payment-queries';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ purchaseId: string }> }
) {
  try {
    const { purchaseId } = await params;
    const body = await request.json();
    const { customerWallet } = body;

    if (!customerWallet) {
      return NextResponse.json(
        { error: 'Customer wallet required' },
        { status: 400 }
      );
    }

    // Get purchase
    const purchase = await getPurchaseById(purchaseId);
    if (!purchase) {
      return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });
    }

    // Verify ownership
    if (purchase.customerWallet !== customerWallet) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Check download limit
    if (purchase.downloadCount! >= purchase.maxDownloads) {
      return NextResponse.json(
        { error: 'Download limit reached' },
        { status: 403 }
      );
    }

    // Check if there's an active link
    let downloadLink = await getActiveDownloadLink(purchaseId, customerWallet);

    if (!downloadLink) {
      // Create new download link
      downloadLink = await createDownloadLink({
        purchaseId: purchase.id,
        productId: purchase.productId,
        customerWallet,
        expiryHours: purchase.product.linkExpiryHours || 24,
      });

      // Increment download count
      await incrementDownloadCount(purchaseId);
    }

    return NextResponse.json({
      success: true,
      downloadLink: {
        token: downloadLink.token,
        expiresAt: downloadLink.expiresAt,
        downloadUrl: `/api/download/${downloadLink.token}`,
      },
      purchase: {
        downloadCount: purchase.downloadCount! + 1,
        maxDownloads: purchase.maxDownloads,
      },
    });
  } catch (error: any) {
    console.error('Generate download link error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
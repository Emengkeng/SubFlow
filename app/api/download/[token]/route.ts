import { NextRequest, NextResponse } from 'next/server';
import { 
  getDownloadLinkByToken,
  markDownloadLinkAsUsed 
} from '@/lib/db/payment-queries';
import { SupabaseStorageService } from '@/lib/storage/supabase-storage';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Get download link
    const downloadLink = await getDownloadLinkByToken(token);
    if (!downloadLink) {
      return NextResponse.json(
        { error: 'Invalid download link' },
        { status: 404 }
      );
    }

    // Check if expired
    if (new Date() > downloadLink.expiresAt) {
      return NextResponse.json(
        { error: 'Download link expired' },
        { status: 410 }
      );
    }

    // Check if already used (optional - can allow multiple downloads within expiry)
    if (downloadLink.isUsed) {
      return NextResponse.json(
        { error: 'Download link already used' },
        { status: 410 }
      );
    }

    // Get product file info
    const product = downloadLink.product;
    if (!product.supabaseFileId) {
      return NextResponse.json(
        { error: 'Product file not found' },
        { status: 404 }
      );
    }

    // Generate signed URL from Supabase (valid for 1 hour)
    const signedUrl = await SupabaseStorageService.generateSignedUrl(
      product.supabaseFileId,
      3600 // 1 hour
    );

    // Mark link as used
    const headers = request.headers;
    await markDownloadLinkAsUsed(
      downloadLink.id,
      headers.get('x-forwarded-for') || headers.get('x-real-ip') || undefined,
      headers.get('user-agent') || undefined
    );

    // Redirect to signed URL
    return NextResponse.redirect(signedUrl);
  } catch (error: any) {
    console.error('Download error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';
import { getProductById, updateProductFile } from '@/lib/db/payment-queries';
import { SupabaseStorageService } from '@/lib/storage/supabase-storage';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { productId } = await params;
    const product = await getProductById(productId);

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file size (max 30MB)
    const maxSize = 30 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large (max 5GB)' },
        { status: 400 }
      );
    }

    // Upload to Supabase
    const { fileId, filePath, fileSize } = await SupabaseStorageService.uploadProductFile(
      product.organizationId,
      productId,
      file,
      file.name
    );

    // Update product record
    const updatedProduct = await updateProductFile(productId, {
      supabaseFileId: fileId,
      supabaseBucket: 'digital-products',
      fileSize,
      fileType: SupabaseStorageService.getFileType(file.name),
    });

    return NextResponse.json({
      success: true,
      product: updatedProduct,
      file: {
        id: fileId,
        path: filePath,
        size: fileSize,
        type: file.type,
      },
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
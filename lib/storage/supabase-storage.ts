import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const BUCKET_NAME = 'digital-products';

export class SupabaseStorageService {
  /**
   * Initialize storage bucket (run once during setup)
   */
  static async initializeBucket() {
    const { data, error } = await supabase.storage.getBucket(BUCKET_NAME);
    
    if (error && error.message.includes('not found')) {
      // Create bucket if it doesn't exist
      const { data: newBucket, error: createError } = await supabase.storage.createBucket(
        BUCKET_NAME,
        {
          public: false, // Private bucket - require signed URLs
           fileSizeLimit: 3 * 1024 * 1024, // 30MB max file size
          // fileSizeLimit: 5 * 1024 * 1024 * 1024, // 5GB max file size
        }
      );

      if (createError) {
        throw new Error(`Failed to create bucket: ${createError.message}`);
      }

      console.log('✅ Storage bucket created:', newBucket);
      return newBucket;
    }

    return data;
  }

  /**
   * Upload a digital product file
   */
  static async uploadProductFile(
    organizationId: string,
    productId: string,
    file: File | Buffer,
    fileName: string
  ): Promise<{
    fileId: string;
    filePath: string;
    fileSize: number;
  }> {
    // Create organized path: org/product/filename
    const filePath = `${organizationId}/${productId}/${fileName}`;

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        upsert: true, // Replace if exists
        contentType: this.getContentType(fileName),
      });

    if (error) {
      throw new Error(`File upload failed: ${error.message}`);
    }

    const fileSize = file instanceof File ? file.size : file.length;

    return {
      fileId: data.path,
      filePath: data.path,
      fileSize,
    };
  }

  /**
   * Generate a signed download URL (expires after X seconds)
   */
  static async generateSignedUrl(
    filePath: string,
    expirySeconds: number = 3600 // 1 hour default
  ): Promise<string> {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, expirySeconds);

    if (error) {
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }

    if (!data?.signedUrl) {
      throw new Error('No signed URL returned');
    }

    return data.signedUrl;
  }

  /**
   * Delete a product file
   */
  static async deleteProductFile(filePath: string): Promise<void> {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (error) {
      throw new Error(`File deletion failed: ${error.message}`);
    }
  }

  /**
   * Get file metadata
   */
  static async getFileMetadata(filePath: string) {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list(filePath);

    if (error) {
      throw new Error(`Failed to get file metadata: ${error.message}`);
    }

    return data;
  }

  /**
   * Helper: Determine content type from filename
   */
  private static getContentType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    
    const contentTypes: Record<string, string> = {
      pdf: 'application/pdf',
      zip: 'application/zip',
      mp4: 'video/mp4',
      mp3: 'audio/mpeg',
      epub: 'application/epub+zip',
      mobi: 'application/x-mobipocket-ebook',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      svg: 'image/svg+xml',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };

    return contentTypes[ext || ''] || 'application/octet-stream';
  }

  /**
   * Helper: Get file extension from filename
   */
  static getFileType(fileName: string): string {
    return fileName.split('.').pop()?.toLowerCase() || 'unknown';
  }
}
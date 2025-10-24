'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Trash2, Upload, Download, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

type Product = {
  id: string;
  name: string;
  description?: string;
  price: string;
  tokenMint: string;
  tokenDecimals: number;
  merchantWallet: string;
  imageUrl?: string;
  fileSize?: number;
  fileType?: string;
  downloadLimit: number;
  linkExpiryHours: number;
  supabaseFileId?: string;
  isActive: boolean;
  createdAt: string;
};

export default function OrgProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [uploadingFile, setUploadingFile] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const orgId = localStorage.getItem('currentOrgId');
      const response = await fetch(`/api/organizations/${orgId}/products`);
      if (response.ok) {
        const data = await response.json();
        setProducts(data.products || []);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsCreating(true);

    const formData = new FormData(e.currentTarget);
    const orgId = localStorage.getItem('currentOrgId');

    try {
      const priceInUSDC = parseFloat(formData.get('price') as string);
      const priceInSmallestUnit = Math.floor(priceInUSDC * 1_000_000).toString();

      const response = await fetch(`/api/organizations/${orgId}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.get('name'),
          description: formData.get('description'),
          price: priceInSmallestUnit,
          tokenMint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', // USDC
          tokenDecimals: 6,
          merchantWallet: formData.get('merchantWallet'),
          imageUrl: formData.get('imageUrl'),
          productType: 'digital',
          downloadLimit: parseInt(formData.get('downloadLimit') as string) || 5,
          linkExpiryHours: parseInt(formData.get('linkExpiryHours') as string) || 24,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        await fetchProducts();
        setCreateDialogOpen(false);
        (e.target as HTMLFormElement).reset();
        
        // Open upload dialog for the new product
        const file = formData.get('file') as File;
        if (file && data.product?.id) {
          await handleFileUpload(data.product.id, file);
        }
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to create product');
      }
    } catch (error) {
      console.error('Failed to create product:', error);
      alert('Failed to create product');
    } finally {
      setIsCreating(false);
    }
  };

  const handleFileUpload = async (productId: string, file: File) => {
    setUploadingFile(productId);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Simulate progress (replace with real upload progress if available)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch(`/api/products/${productId}/upload`, {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (response.ok) {
        await fetchProducts();
        setTimeout(() => {
          setUploadingFile(null);
          setUploadProgress(0);
        }, 1000);
      } else {
        const data = await response.json();
        alert(data.error || 'Upload failed');
        setUploadingFile(null);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed');
      setUploadingFile(null);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  const formatPrice = (price: string, decimals: number = 6) => {
    const num = parseFloat(price) / Math.pow(10, decimals);
    return num.toFixed(2);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
      </div>
    );
  }

  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Digital Products</h1>
          <p className="text-gray-600">Create and manage your digital products</p>
        </div>
        
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-orange-600 hover:bg-orange-700">
              <Plus className="h-4 w-4 mr-2" />
              Create Product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Digital Product</DialogTitle>
              <DialogDescription>
                Upload a digital product for sale on the marketplace
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateProduct} className="space-y-4">
              <div>
                <Label htmlFor="name">Product Name *</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="Ultimate React Course"
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Learn React from scratch with hands-on projects..."
                  rows={3}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="price">Price (USDC) *</Label>
                  <Input
                    id="price"
                    name="price"
                    type="number"
                    step="0.01"
                    placeholder="50.00"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="imageUrl">Preview Image URL</Label>
                  <Input
                    id="imageUrl"
                    name="imageUrl"
                    type="url"
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="file">Upload Digital File *</Label>
                <Input
                  id="file"
                  name="file"
                  type="file"
                  required
                  accept=".pdf,.zip,.mp4,.mp3,.epub,.mobi"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Supported: PDF, ZIP, MP4, MP3, EPUB, MOBI (max 5GB)
                </p>
              </div>

              <div>
                <Label htmlFor="merchantWallet">Your Wallet Address *</Label>
                <Input
                  id="merchantWallet"
                  name="merchantWallet"
                  placeholder="Your Solana wallet address"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="downloadLimit">Download Limit</Label>
                  <Input
                    id="downloadLimit"
                    name="downloadLimit"
                    type="number"
                    defaultValue="5"
                    min="1"
                    max="100"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Max downloads per purchase
                  </p>
                </div>

                <div>
                  <Label htmlFor="linkExpiryHours">Link Expiry (hours)</Label>
                  <Input
                    id="linkExpiryHours"
                    name="linkExpiryHours"
                    type="number"
                    defaultValue="24"
                    min="1"
                    max="168"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    How long download links last
                  </p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Pricing Model</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Customers pay product price + $1 platform fee</li>
                  <li>• You receive 100% of product price</li>
                  <li>• Files stored securely with expiring download links</li>
                  <li>• Customers can re-download within limits</li>
                </ul>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isCreating}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {isCreating ? 'Creating...' : 'Create & Upload'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {products.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No products yet</h3>
            <p className="text-gray-600 text-center max-w-sm mb-4">
              Upload your first digital product to start selling
            </p>
            <Button
              onClick={() => setCreateDialogOpen(true)}
              className="bg-orange-600 hover:bg-orange-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Product
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <Card key={product.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-1">{product.name}</CardTitle>
                    <div className="flex gap-2 flex-wrap">
                      {product.isActive ? (
                        <Badge className="bg-green-100 text-green-800">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                      {product.supabaseFileId && (
                        <Badge className="bg-blue-100 text-blue-800">
                          <Download className="h-3 w-3 mr-1" />
                          File Uploaded
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {product.imageUrl && (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                  )}

                  {product.description && (
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {product.description}
                    </p>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between py-2 border-t">
                      <span className="text-sm text-gray-600">Price</span>
                      <span className="text-xl font-bold text-orange-600">
                        ${formatPrice(product.price, product.tokenDecimals)}
                      </span>
                    </div>

                    {product.fileSize && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">File Size</span>
                        <span>{formatFileSize(product.fileSize)}</span>
                      </div>
                    )}

                    {product.fileType && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">File Type</span>
                        <span className="uppercase">{product.fileType}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Download Limit</span>
                      <span>{product.downloadLimit}x</span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Link Expiry</span>
                      <span>{product.linkExpiryHours}h</span>
                    </div>
                  </div>

                  {uploadingFile === product.id && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Uploading...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <Progress value={uploadProgress} />
                    </div>
                  )}

                  {!product.supabaseFileId && uploadingFile !== product.id && (
                    <div className="pt-2">
                      <Label htmlFor={`file-${product.id}`} className="cursor-pointer">
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-orange-500 transition-colors">
                          <Upload className="h-6 w-6 mx-auto mb-2 text-gray-400" />
                          <span className="text-sm text-gray-600">Upload Product File</span>
                          <Input
                            id={`file-${product.id}`}
                            type="file"
                            className="hidden"
                            accept=".pdf,.zip,.mp4,.mp3,.epub,.mobi"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(product.id, file);
                            }}
                          />
                        </div>
                      </Label>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Trash2, DollarSign, Copy, ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';

type Product = {
  id: string;
  name: string;
  description?: string;
  price: string;
  tokenMint: string;
  tokenDecimals: number;
  merchantWallet: string;
  imageUrl?: string;
  isActive: boolean;
  createdAt: string;
};

export default function OrgProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
          tokenMint: formData.get('tokenMint') || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          tokenDecimals: 6,
          merchantWallet: formData.get('merchantWallet'),
          imageUrl: formData.get('imageUrl'),
        }),
      });

      if (response.ok) {
        await fetchProducts();
        setCreateDialogOpen(false);
        (e.target as HTMLFormElement).reset();
      }
    } catch (error) {
      console.error('Failed to create product:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedProduct) return;
    
    setIsEditing(true);
    const formData = new FormData(e.currentTarget);
    const orgId = localStorage.getItem('currentOrgId');

    try {
      const priceValue = formData.get('price');
      const priceInSmallestUnit = priceValue 
        ? Math.floor(parseFloat(priceValue as string) * 1_000_000).toString()
        : undefined;

      const response = await fetch(`/api/organizations/${orgId}/products`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProduct.id,
          name: formData.get('name'),
          description: formData.get('description'),
          price: priceInSmallestUnit,
          imageUrl: formData.get('imageUrl'),
          isActive: formData.get('isActive') === 'true',
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        await fetchProducts();
        setEditDialogOpen(false);
        setSelectedProduct(null);
      } else {
        alert(data.error || 'Failed to update product');
      }
    } catch (error) {
      console.error('Failed to update product:', error);
      alert('Failed to update product');
    } finally {
      setIsEditing(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!selectedProduct) return;
    
    setIsDeleting(true);
    const orgId = localStorage.getItem('currentOrgId');

    try {
      const response = await fetch(
        `/api/organizations/${orgId}/products?productId=${selectedProduct.id}`,
        { method: 'DELETE' }
      );

      const data = await response.json();

      if (response.ok) {
        await fetchProducts();
        setDeleteDialogOpen(false);
        setSelectedProduct(null);
      } else {
        alert(data.error || 'Failed to delete product');
      }
    } catch (error) {
      console.error('Failed to delete product:', error);
      alert('Failed to delete product');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatPrice = (price: string, decimals: number = 6) => {
    const num = parseFloat(price) / Math.pow(10, decimals);
    return num.toFixed(2);
  };

  const copyProductId = (productId: string) => {
    navigator.clipboard.writeText(productId);
    setCopiedId(productId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getPaymentWidgetUrl = (productId: string) => {
    return `${window.location.origin}/pay/${productId}`;
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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Products</h1>
          <p className="text-gray-600">Create and manage products for your payment widget</p>
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
              <DialogTitle>Create Product</DialogTitle>
              <DialogDescription>
                Add a new product that customers can purchase with crypto
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateProduct} className="space-y-4">
              <div>
                <Label htmlFor="name">Product Name *</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="Premium Course"
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Full access to all premium features..."
                  rows={3}
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
                  <p className="text-xs text-gray-500 mt-1">
                    Customer pays this + $1 platform fee
                  </p>
                </div>

                <div>
                  <Label htmlFor="imageUrl">Image URL</Label>
                  <Input
                    id="imageUrl"
                    name="imageUrl"
                    type="url"
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="merchantWallet">Your Wallet Address *</Label>
                <Input
                  id="merchantWallet"
                  name="merchantWallet"
                  placeholder="Your Solana wallet address"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Where you'll receive payments
                </p>
              </div>

              <div>
                <Label htmlFor="tokenMint">Token Mint Address</Label>
                <Input
                  id="tokenMint"
                  name="tokenMint"
                  defaultValue="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
                />
                <p className="text-xs text-gray-500 mt-1">
                  USDC by default (recommended)
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Platform Fee Model</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Customer pays product price + $1 platform fee</li>
                  <li>• You receive 100% of product price</li>
                  <li>• Platform sponsors gas costs</li>
                  <li>• One-time payment (no subscriptions)</li>
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
                  {isCreating ? 'Creating...' : 'Create Product'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>
              Update product details
            </DialogDescription>
          </DialogHeader>
          {selectedProduct && (
            <form onSubmit={handleEditProduct} className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Product Name *</Label>
                <Input
                  id="edit-name"
                  name="name"
                  defaultValue={selectedProduct.name}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  name="description"
                  defaultValue={selectedProduct.description || ''}
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="edit-price">Price (USDC)</Label>
                <Input
                  id="edit-price"
                  name="price"
                  type="number"
                  step="0.01"
                  defaultValue={formatPrice(selectedProduct.price, selectedProduct.tokenDecimals)}
                />
              </div>
              <div>
                <Label htmlFor="edit-imageUrl">Image URL</Label>
                <Input
                  id="edit-imageUrl"
                  name="imageUrl"
                  defaultValue={selectedProduct.imageUrl || ''}
                />
              </div>
              <div>
                <Label htmlFor="edit-isActive">Status</Label>
                <select
                  id="edit-isActive"
                  name="isActive"
                  defaultValue={selectedProduct.isActive ? 'true' : 'false'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditDialogOpen(false);
                    setSelectedProduct(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isEditing}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {isEditing ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedProduct?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedProduct(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProduct}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Deleting...' : 'Delete Product'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Products List */}
      {products.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <DollarSign className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No products yet</h3>
            <p className="text-gray-600 text-center max-w-sm mb-4">
              Create your first product to start accepting crypto payments
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
                    {product.isActive ? (
                      <Badge className="bg-green-100 text-green-800">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        setSelectedProduct(product);
                        setEditDialogOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        setSelectedProduct(product);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
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
                      <span className="text-sm text-gray-600">Product Price</span>
                      <span className="text-xl font-bold text-orange-600">
                        ${formatPrice(product.price, product.tokenDecimals)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Platform Fee</span>
                      <span className="text-gray-500">$1.00</span>
                    </div>

                    <div className="flex items-center justify-between text-sm font-semibold border-t pt-2">
                      <span>Customer Pays</span>
                      <span>
                        ${(parseFloat(formatPrice(product.price, product.tokenDecimals)) + 1).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => copyProductId(product.id)}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        {copiedId === product.id ? 'Copied!' : 'Copy ID'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => window.open(getPaymentWidgetUrl(product.id), '_blank')}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        View Widget
                      </Button>
                    </div>
                    
                    <p className="text-xs text-gray-500 text-center">
                      Product ID: {product.id.substring(0, 8)}...
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
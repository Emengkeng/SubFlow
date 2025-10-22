'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ShoppingBag, Search, Loader2, Package } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: string;
  displayPrice: string;
  imageUrl: string | null;
  tokenMint: string;
  tokenDecimals: number;
  isActive: boolean;
  createdAt: string;
  organization: {
    id: string;
    name: string;
    logoUrl: string | null;
  };
};

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/public/products');
      
      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }

      const data = await response.json();
      setProducts(data.products || []);
    } catch (err: any) {
      console.error('Fetch products error:', err);
      setError(err.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter((product) => {
    const query = searchQuery.toLowerCase();
    return (
      product.name.toLowerCase().includes(query) ||
      product.description?.toLowerCase().includes(query) ||
      product.organization.name.toLowerCase().includes(query)
    );
  });

  const handleProductClick = (productId: string) => {
    router.push(`/products/${productId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-orange-600 to-orange-700 text-white">
        <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">Product Marketplace</h1>
            <p className="text-xl text-orange-100 mb-8">
              Browse and purchase products with crypto payments
            </p>
            
            {/* Search Bar */}
            <div className="max-w-2xl mx-auto">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search products or merchants..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 py-6 text-lg bg-white text-gray-900"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {filteredProducts.length} Products Available
          </h2>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {searchQuery ? 'No products found' : 'No products available'}
            </h3>
            <p className="text-gray-600">
              {searchQuery
                ? 'Try adjusting your search terms'
                : 'Check back later for new products'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => (
              <Card
                key={product.id}
                className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => handleProductClick(product.id)}
              >
                <div className="relative h-48 bg-gray-200">
                  {product.imageUrl ? (
                    <Image
                      src={product.imageUrl}
                      alt={product.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <Package className="h-16 w-16 text-gray-400" />
                    </div>
                  )}
                  {!product.isActive && (
                    <Badge className="absolute top-2 right-2 bg-gray-800">
                      Unavailable
                    </Badge>
                  )}
                </div>

                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg line-clamp-2">
                      {product.name}
                    </CardTitle>
                  </div>
                  {product.organization && (
                    <div className="flex items-center gap-2 mt-2">
                      {product.organization.logoUrl ? (
                        <Image
                          src={product.organization.logoUrl}
                          alt={product.organization.name}
                          width={20}
                          height={20}
                          className="rounded-full"
                        />
                      ) : (
                        <ShoppingBag className="h-4 w-4 text-gray-400" />
                      )}
                      <span className="text-sm text-gray-600">
                        {product.organization.name}
                      </span>
                    </div>
                  )}
                </CardHeader>

                <CardContent>
                  {product.description && (
                    <p className="text-sm text-gray-600 line-clamp-3 mb-4">
                      {product.description}
                    </p>
                  )}

                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-gray-900">
                      {product.displayPrice}
                    </span>
                    <span className="text-sm text-gray-500">USDC</span>
                  </div>
                </CardContent>

                <CardFooter>
                  <Button
                    className="w-full bg-orange-600 hover:bg-orange-700"
                    disabled={!product.isActive}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleProductClick(product.id);
                    }}
                  >
                    {product.isActive ? 'View Product' : 'Unavailable'}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
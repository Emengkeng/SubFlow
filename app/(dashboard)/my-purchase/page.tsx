'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Download,
  Clock,
  CheckCircle,
  AlertCircle,
  FileText,
  ExternalLink,
  Loader2,
} from 'lucide-react';

type Purchase = {
  id: string;
  product: {
    id: string;
    name: string;
    description?: string;
    imageUrl?: string;
    fileType?: string;
    fileSize?: number;
  };
  organization: {
    name: string;
    logoUrl?: string;
  };
  pricePaid: string;
  txSignature: string;
  downloadCount: number;
  maxDownloads: number;
  lastDownloadAt?: string;
  createdAt: string;
  canDownload: boolean;
};

type DownloadLink = {
  token: string;
  expiresAt: string;
  downloadUrl: string;
};

export default function MyPurchasesPage() {
  const { publicKey, connected } = useWallet();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [activeLink, setActiveLink] = useState<DownloadLink | null>(null);

  useEffect(() => {
    if (connected && publicKey) {
      fetchPurchases();
    }
  }, [connected, publicKey]);

  const fetchPurchases = async () => {
    if (!publicKey) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/purchases/wallet/${publicKey.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch purchases');
      }

      const data = await response.json();
      setPurchases(data.purchases || []);
    } catch (err: any) {
      console.error('Fetch purchases error:', err);
      setError(err.message || 'Failed to load purchases');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (purchaseId: string) => {
    if (!publicKey) return;

    setDownloadingId(purchaseId);
    setError(null);
    setActiveLink(null);

    try {
      const response = await fetch(`/api/purchases/${purchaseId}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerWallet: publicKey.toString(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate download link');
      }

      const data = await response.json();
      setActiveLink(data.downloadLink);

      // Refresh purchases to update download count
      await fetchPurchases();

      // Auto-download
      window.open(data.downloadLink.downloadUrl, '_blank');
    } catch (err: any) {
      console.error('Download error:', err);
      setError(err.message);
    } finally {
      setDownloadingId(null);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatPrice = (price: string) => {
    return `$${(parseFloat(price) / 1_000_000).toFixed(2)}`;
  };

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expired';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (!connected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <CardTitle>Connect Your Wallet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-gray-600">
              Connect your wallet to view your purchased digital products
            </p>
            <div className="flex justify-center">
              <WalletMultiButton />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Purchases</h1>
          <p className="text-gray-600">
            Download your purchased digital products
          </p>
          <div className="mt-4 flex items-center gap-2">
            <Badge variant="outline">
              {publicKey ? `${publicKey.toString().slice(0, 8)}...${publicKey.toString().slice(-8)}` : ''}
            </Badge>
            <Button variant="ghost" size="sm" onClick={fetchPurchases}>
              Refresh
            </Button>
          </div>
        </div>

        {/* Active Download Link Alert */}
        {activeLink && (
          <Alert className="mb-6 bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-green-900">Download link generated!</p>
                  <p className="text-sm text-green-700 mt-1">
                    Link expires in {getTimeRemaining(activeLink.expiresAt)}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => window.open(activeLink.downloadUrl, '_blank')}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Download Now
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
          </div>
        ) : purchases.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-16 w-16 text-gray-400 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No purchases yet
              </h3>
              <p className="text-gray-600 mb-6">
                Browse the marketplace to purchase digital products
              </p>
              <Button
                onClick={() => window.location.href = '/products'}
                className="bg-orange-600 hover:bg-orange-700"
              >
                Browse Products
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {purchases.map((purchase) => (
              <Card key={purchase.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-1">
                        {purchase.product.name}
                      </CardTitle>
                      {purchase.organization && (
                        <p className="text-sm text-gray-600">
                          by {purchase.organization.name}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-2 flex-wrap">
                    {purchase.canDownload ? (
                      <Badge className="bg-green-100 text-green-800">
                        <Download className="h-3 w-3 mr-1" />
                        Available
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        Limit Reached
                      </Badge>
                    )}
                    {purchase.product.fileType && (
                      <Badge variant="outline" className="uppercase">
                        {purchase.product.fileType}
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {purchase.product.imageUrl && (
                    <img
                      src={purchase.product.imageUrl}
                      alt={purchase.product.name}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                  )}

                  {purchase.product.description && (
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {purchase.product.description}
                    </p>
                  )}

                  <div className="space-y-2 text-sm border-t pt-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Purchased:</span>
                      <span className="font-medium">
                        {formatDate(purchase.createdAt)}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-600">Price Paid:</span>
                      <span className="font-medium">
                        {formatPrice(purchase.pricePaid)}
                      </span>
                    </div>

                    {purchase.product.fileSize && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">File Size:</span>
                        <span>{formatFileSize(purchase.product.fileSize)}</span>
                      </div>
                    )}

                    <div className="flex justify-between">
                      <span className="text-gray-600">Downloads:</span>
                      <span>
                        {purchase.downloadCount} / {purchase.maxDownloads}
                      </span>
                    </div>

                    {purchase.lastDownloadAt && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Last Download:</span>
                        <span>{formatDate(purchase.lastDownloadAt)}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 border-t pt-3">
                    <Button
                      onClick={() => handleDownload(purchase.id)}
                      disabled={!purchase.canDownload || downloadingId === purchase.id}
                      className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50"
                    >
                      {downloadingId === purchase.id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Generating Link...
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-2" />
                          {purchase.canDownload ? 'Download' : 'Limit Reached'}
                        </>
                      )}
                    </Button>

                    <a
                      href={`https://explorer.solana.com/tx/${purchase.txSignature}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-gray-900"
                    >
                      View Transaction
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>

                  {!purchase.canDownload && (
                    <Alert className="bg-yellow-50 border-yellow-200">
                      <Clock className="h-4 w-4 text-yellow-600" />
                      <AlertDescription className="text-sm text-yellow-800">
                        Download limit reached. Contact support if you need access.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Info Section */}
        {purchases.length > 0 && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="text-lg">Download Guidelines</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6 text-sm">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Download className="h-5 w-5 text-orange-600" />
                    <h4 className="font-semibold">Secure Downloads</h4>
                  </div>
                  <p className="text-gray-600">
                    Each download link is unique and expires after a set time for security.
                  </p>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-5 w-5 text-orange-600" />
                    <h4 className="font-semibold">Limited Downloads</h4>
                  </div>
                  <p className="text-gray-600">
                    Products have download limits to prevent abuse. Check your remaining downloads.
                  </p>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-5 w-5 text-orange-600" />
                    <h4 className="font-semibold">Re-download Anytime</h4>
                  </div>
                  <p className="text-gray-600">
                    Generate new download links anytime within your download limit.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
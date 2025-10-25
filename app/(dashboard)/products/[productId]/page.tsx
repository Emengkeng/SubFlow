// app/products/[productId]/page.tsx
// Updated to show if user already owns the product

'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Connection, VersionedTransaction } from '@solana/web3.js';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Package, ShoppingBag, CheckCircle, AlertCircle, 
  Loader2, ArrowLeft, ExternalLink, Download, FileText 
} from 'lucide-react';
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
  merchantWallet: string;
  fileType?: string;
  fileSize?: number;
  downloadLimit: number;
  linkExpiryHours: number;
  isActive: boolean;
  organization: {
    id: string;
    name: string;
    logoUrl: string | null;
    website: string | null;
  };
};

type Purchase = {
  id: string;
  downloadCount: number;
  maxDownloads: number;
  canDownload: boolean;
};

const PLATFORM_FEE = 1.0;

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { publicKey, signTransaction, connected, sendTransaction } = useWallet();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  const purchaseInProgress = useRef(false);
  const productId = params.productId as string;

  useEffect(() => {
    if (productId) {
      fetchProduct();
    }
  }, [productId]);

  useEffect(() => {
    if (connected && publicKey && product) {
      checkPurchaseStatus();
    }
  }, [connected, publicKey, product]);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/products/${productId}`);
      
      if (!response.ok) {
        throw new Error('Product not found');
      }

      const data = await response.json();
      setProduct(data.product);
    } catch (err: any) {
      console.error('Fetch product error:', err);
      setError(err.message || 'Failed to load product');
    } finally {
      setLoading(false);
    }
  };

  const checkPurchaseStatus = async () => {
    if (!publicKey) return;

    try {
      const response = await fetch(`/api/purchases/wallet/${publicKey.toString()}`);
      if (response.ok) {
        const data = await response.json();
        const existingPurchase = data.purchases.find(
          (p: any) => p.product.id === productId
        );
        
        if (existingPurchase) {
          setPurchase(existingPurchase);
        }
      }
    } catch (err) {
      console.error('Check purchase status error:', err);
    }
  };

  const handlePurchase = async () => {
    if (purchaseInProgress.current) return;
    if (!connected || !publicKey || !signTransaction) {
      setError('Please connect your wallet first');
      return;
    }
    if (!product?.isActive) {
      setError('This product is currently unavailable');
      return;
    }

    purchaseInProgress.current = true;
    setProcessing(true);
    setError(null);

    let sessionId: string | null = null;

    try {
      console.log('🚀 Starting purchase flow...');

      // Create payment session
      const sessionResponse = await fetch('/api/payments/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          customerWallet: publicKey.toString(),
          metadata: {
            orderId: `ORD-${Date.now()}`,
            productName: product.name,
            timestamp: new Date().toISOString(),
          },
        }),
      });

      if (!sessionResponse.ok) {
        const errorData = await sessionResponse.json();
        throw new Error(errorData.error || 'Failed to create payment session');
      }

      const sessionData = await sessionResponse.json();
      sessionId = sessionData.session.id;

      // Deserialize transaction
      const transactionBuffer = Buffer.from(sessionData.transaction, 'base64');
      const transaction = VersionedTransaction.deserialize(transactionBuffer);

      // Send transaction
      const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com';
      const connection = new Connection(rpcUrl, {
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: 60000,
      });

      const signature = await sendTransaction(transaction, connection, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 2,
      });

      setTxSignature(signature);

      // Wait for confirmation
      const confirmation = await connection.confirmTransaction(signature, 'confirmed');

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      // Confirm with backend
      const confirmResponse = await fetch('/api/payments/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId,
          txSignature: signature,
        }),
      });

      if (confirmResponse.ok) {
        const confirmData = await confirmResponse.json();
        setPurchase(confirmData.purchase);
      }

      setSuccess(true);
    } catch (err: any) {
      console.error('❌ Purchase failed:', err);
      
      let errorMessage = 'Payment failed. Please try again.';
      if (err.message?.includes('User rejected') || err.message?.includes('rejected')) {
        errorMessage = 'Transaction was cancelled.';
      } else if (err.message?.includes('insufficient')) {
        errorMessage = 'Insufficient balance in your wallet.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setProcessing(false);
      purchaseInProgress.current = false;
    }
  };

  const handleDownload = () => {
    router.push('/purchases');
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return null;
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <AlertCircle className="h-16 w-16 text-gray-400 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Product Not Found</h2>
        <Button onClick={() => router.push('/products')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Products
        </Button>
      </div>
    );
  }

  const productPrice = parseFloat(product.displayPrice.replace('$', ''));
  const totalPrice = productPrice + PLATFORM_FEE;

  if (success && purchase) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Purchase Successful! 🎉</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-gray-600">
              Your purchase has been confirmed. You can now download your product.
            </p>
            
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Product:</span>
                <span className="font-medium">{product.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Downloads Available:</span>
                <span className="font-medium">
                  {purchase.downloadCount} / {purchase.maxDownloads}
                </span>
              </div>
              {product.linkExpiryHours && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Link Expires After:</span>
                  <span className="font-medium">{product.linkExpiryHours}h</span>
                </div>
              )}
            </div>

            {txSignature && (
              <a
                href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-sm text-orange-600 hover:text-orange-700"
              >
                View Transaction
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button
              variant="default"
              className="flex-1 bg-orange-600 hover:bg-orange-700"
              onClick={handleDownload}
            >
              <Download className="h-4 w-4 mr-2" />
              Download Now
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <Button
          variant="ghost"
          onClick={() => router.push('/products')}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Products
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Product Image */}
          <div className="bg-white rounded-lg p-8 flex items-center justify-center">
            {product.imageUrl ? (
              <div className="relative w-full h-96">
                <Image
                  src={product.imageUrl}
                  alt={product.name}
                  fill
                  className="object-contain"
                />
              </div>
            ) : (
              <FileText className="h-48 w-48 text-gray-300" />
            )}
          </div>

          {/* Product Details */}
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                {product.organization.logoUrl ? (
                  <Image
                    src={product.organization.logoUrl}
                    alt={product.organization.name}
                    width={24}
                    height={24}
                    className="rounded-full"
                  />
                ) : (
                  <ShoppingBag className="h-5 w-5 text-gray-400" />
                )}
                <span className="text-sm text-gray-600">
                  {product.organization.name}
                </span>
                {product.organization.website && (
                  <a
                    href={product.organization.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-orange-600 hover:text-orange-700"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>

              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                {product.name}
              </h1>

              <div className="flex gap-2 flex-wrap mb-4">
                {!product.isActive && (
                  <Badge variant="secondary">Currently Unavailable</Badge>
                )}
                {product.fileType && (
                  <Badge variant="outline" className="uppercase">
                    {product.fileType}
                  </Badge>
                )}
                {purchase && (
                  <Badge className="bg-green-100 text-green-800">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Owned
                  </Badge>
                )}
              </div>

              {product.description && (
                <p className="text-gray-600 leading-relaxed">
                  {product.description}
                </p>
              )}
            </div>

            <Separator />

            {/* Product Info */}
            <Card>
              <CardHeader>
                <CardTitle>Product Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {product.fileSize && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">File Size:</span>
                    <span className="font-medium">{formatFileSize(product.fileSize)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Download Limit:</span>
                  <span className="font-medium">{product.downloadLimit}x</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Link Expiry:</span>
                  <span className="font-medium">{product.linkExpiryHours} hours</span>
                </div>
                {purchase && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Your Downloads:</span>
                    <span className="font-medium">
                      {purchase.downloadCount} / {purchase.maxDownloads}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Separator />

            {/* Pricing Card */}
            {!purchase && (
              <Card>
                <CardHeader>
                  <CardTitle>Price Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Product Price:</span>
                    <span className="font-medium">${productPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Platform Fee:</span>
                    <span className="font-medium">${PLATFORM_FEE.toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg">
                    <span className="font-bold">Total:</span>
                    <span className="font-bold text-orange-600">
                      ${totalPrice.toFixed(2)} USDC
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    * Plus network fees (~$0.00005 SOL)
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Error Alert */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Action Buttons */}
            <div className="space-y-3">
              {!connected && (
                <div className="flex justify-center">
                  <WalletMultiButton />
                </div>
              )}

              {connected && !purchase && (
                <Button
                  onClick={handlePurchase}
                  disabled={!connected || processing || !product.isActive || purchaseInProgress.current}
                  className="w-full bg-orange-600 hover:bg-orange-700 h-12 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Processing Payment...
                    </>
                  ) : (
                    `Purchase for ${totalPrice.toFixed(2)} USDC`
                  )}
                </Button>
              )}

              {connected && purchase && (
                <Button
                  onClick={handleDownload}
                  className="w-full bg-orange-600 hover:bg-orange-700 h-12 text-lg"
                >
                  <Download className="h-5 w-5 mr-2" />
                  Go to Downloads
                </Button>
              )}

              {connected && (
                <p className="text-xs text-center text-gray-500">
                  Connected: {publicKey?.toString().slice(0, 8)}...
                  {publicKey?.toString().slice(-8)}
                </p>
              )}
            </div>

            {/* Security Notice */}
            <Alert className="bg-blue-50 border-blue-200">
              <CheckCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-sm text-blue-800">
                <strong>Secure Purchase:</strong> Your file is stored securely and you'll receive 
                a unique download link. Links expire after {product.linkExpiryHours} hours but 
                you can generate new ones up to {product.downloadLimit} times.
              </AlertDescription>
            </Alert>
          </div>
        </div>

        {/* Additional Info Section */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="bg-orange-100 rounded-full h-12 w-12 flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl font-bold text-orange-600">1</span>
                </div>
                <h4 className="font-semibold mb-1">Connect Wallet</h4>
                <p className="text-sm text-gray-600">
                  Connect your Solana wallet to make a purchase
                </p>
              </div>

              <div className="text-center">
                <div className="bg-orange-100 rounded-full h-12 w-12 flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl font-bold text-orange-600">2</span>
                </div>
                <h4 className="font-semibold mb-1">Complete Payment</h4>
                <p className="text-sm text-gray-600">
                  Pay with USDC on Solana - fast and cheap
                </p>
              </div>

              <div className="text-center">
                <div className="bg-orange-100 rounded-full h-12 w-12 flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl font-bold text-orange-600">3</span>
                </div>
                <h4 className="font-semibold mb-1">Get Access</h4>
                <p className="text-sm text-gray-600">
                  Instant access to your purchase after confirmation
                </p>
              </div>

              <div className="text-center">
                <div className="bg-orange-100 rounded-full h-12 w-12 flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl font-bold text-orange-600">4</span>
                </div>
                <h4 className="font-semibold mb-1">Download Anytime</h4>
                <p className="text-sm text-gray-600">
                  Generate download links within your limit
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
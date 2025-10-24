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
  Loader2, ArrowLeft, ExternalLink 
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
  isActive: boolean;
  organization: {
    id: string;
    name: string;
    logoUrl: string | null;
    website: string | null;
  };
};

const PLATFORM_FEE = 1.0; // $1 platform fee

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { publicKey, signTransaction, connected, sendTransaction } = useWallet();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  // Prevent double-click purchases
  const purchaseInProgress = useRef(false);

  const productId = params.productId as string;

  useEffect(() => {
    if (productId) {
      fetchProduct();
    }
  }, [productId]);

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

  const handlePurchase = async () => {
    // Prevent double-clicks
    if (purchaseInProgress.current) {
      console.log('⚠️  Purchase already in progress, ignoring click');
      return;
    }

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
      console.log('🚀 Starting payment flow...');

      // Step 1: Create payment session and get UNSIGNED transaction
      console.log('📝 Creating payment session...');
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
      console.log('✅ Session created:', sessionId);

      // Step 2: Deserialize the UNSIGNED transaction
      console.log('📦 Deserializing transaction...');
      const transactionBuffer = Buffer.from(sessionData.transaction, 'base64');
      const transaction = VersionedTransaction.deserialize(transactionBuffer);
      
      console.log('📝 Transaction info:');
      console.log('  - Signature slots:', transaction.signatures.length);
      console.log('  - Instructions:', transaction.message.compiledInstructions.length);

      // Verify transaction is unsigned
      const hasAnySignature = transaction.signatures.some(sig => 
        sig.some(b => b !== 0)
      );
      
      if (hasAnySignature) {
        console.error('❌ Transaction already has signatures - this should not happen!');
        throw new Error('Transaction already signed. Please refresh and try again.');
      }

      console.log('✅ Transaction is unsigned as expected');

      // Step 3: Customer signs the ENTIRE transaction
      console.log('🔐 Requesting customer signature...');
      console.log('⏳ Please approve the transaction in your wallet...');

      // Step 4: Send transaction to network
      const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com';
      console.log('🌐 Connecting to RPC:', rpcUrl);
      
      const connection = new Connection(rpcUrl, {
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: 60000,
      });

      console.log('📡 Sending transaction to Solana network...');
      
      // Send with retry logic
      let signature: string;
      try {
        signature = await sendTransaction(
          transaction,
          connection,
          {
            skipPreflight: false, // Enable preflight to catch errors early
            preflightCommitment: 'confirmed',
            maxRetries: 2, // Reduced retries to avoid duplicate processing
          }
        );
        console.log('✅ Transaction sent successfully!');
        console.log('📝 Signature:', signature);
        setTxSignature(signature)
      } catch (sendError: any) {
        console.error('❌ Failed to send transaction:', sendError);
        
        // Check if it's a duplicate/already processed error
        if (sendError.message?.includes('already been processed')) {
          throw new Error('Transaction was already submitted. Please wait or refresh the page.');
        }
        
        throw sendError;
      }

      console.log('✅ Transaction sent successfully!');
      console.log('📝 Signature:', signature);
      setTxSignature(signature);

      // Step 5: Wait for confirmation
      console.log('⏳ Waiting for transaction confirmation...');
      
      const confirmation = await connection.confirmTransaction(
        signature,
        'confirmed'
      );

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      console.log('✅ Transaction confirmed on-chain!');

      // Step 6: Notify backend about successful payment
      console.log('💾 Updating payment record on backend...');
      
      try {
        const confirmResponse = await fetch('/api/payments/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sessionId,
            txSignature: signature,
          }),
        });

        if (!confirmResponse.ok) {
          console.warn('⚠️  Backend confirmation failed, but transaction succeeded on-chain');
          console.warn('Transaction signature:', signature);
          // Don't throw - transaction succeeded on chain
        } else {
          const confirmData = await confirmResponse.json();
          console.log('✅ Payment confirmed on backend:', confirmData.payment);
        }
      } catch (confirmError) {
        console.warn('⚠️  Backend confirmation error:', confirmError);
        // Don't throw - transaction succeeded on chain
      }

      setSuccess(true);
    } catch (err: any) {
      console.error('❌ Purchase failed:', err);
      
      // Enhanced error logging
      if (err.logs) {
        console.error('📜 Transaction logs:', err.logs);
      }
      
      // Provide user-friendly error messages
      let errorMessage = 'Payment failed. Please try again.';
      
      if (err.message?.includes('User rejected') || err.message?.includes('rejected')) {
        errorMessage = 'Transaction was cancelled.';
      } else if (err.message?.includes('insufficient')) {
        errorMessage = 'Insufficient balance in your wallet.';
      } else if (err.message?.includes('blockhash') || err.message?.includes('expired')) {
        errorMessage = 'Transaction expired. Please try again.';
      } else if (err.message?.includes('already been processed')) {
        errorMessage = 'Transaction was already submitted. Please check your transaction history.';
      } else if (err.message?.includes('0x1')) {
        errorMessage = 'Insufficient funds for transaction fee.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setProcessing(false);
      purchaseInProgress.current = false;
    }
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
        <p className="text-gray-600 mb-6">The product you're looking for doesn't exist.</p>
        <Button onClick={() => router.push('/products')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Products
        </Button>
      </div>
    );
  }

  const productPrice = parseFloat(product.displayPrice.replace('$', ''));
  const totalPrice = productPrice + PLATFORM_FEE;

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Payment Successful! 🎉</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-gray-600">
              Your payment has been confirmed on the Solana blockchain.
            </p>
            
            {txSignature && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-2">Transaction Signature:</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs text-gray-600 break-all flex-1">
                    {txSignature}
                  </code>
                  <a
                    href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-orange-600 hover:text-orange-700 flex-shrink-0"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            )}

            <Separator />

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Product:</span>
                <span className="font-medium">{product.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Amount Paid:</span>
                <span className="font-medium">${totalPrice.toFixed(2)} USDC</span>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => router.push('/products')}
            >
              Browse More
            </Button>
            <Button
              variant="default"
              className="flex-1"
              onClick={() => window.location.reload()}
            >
              Buy Again
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
              <Package className="h-48 w-48 text-gray-300" />
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

              {!product.isActive && (
                <Badge variant="secondary" className="mb-4">
                  Currently Unavailable
                </Badge>
              )}

              {product.description && (
                <p className="text-gray-600 leading-relaxed">
                  {product.description}
                </p>
              )}
            </div>

            <Separator />

            {/* Pricing Card */}
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

            {/* Error Alert */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Wallet Connect & Purchase */}
            <div className="space-y-3">
              {!connected && (
                <div className="flex justify-center">
                  <WalletMultiButton />
                </div>
              )}

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
                  `Pay ${totalPrice.toFixed(2)} USDC`
                )}
              </Button>

              {connected && (
                <p className="text-xs text-center text-gray-500">
                  Connected: {publicKey?.toString().slice(0, 8)}...
                  {publicKey?.toString().slice(-8)}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
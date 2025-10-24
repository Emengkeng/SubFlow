import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Wallet, CheckCircle, XCircle, Loader2, 
  ShoppingCart, DollarSign, Shield 
} from 'lucide-react';

interface PaymentWidgetProps {
  productId: string;
  apiKey?: string;
  onSuccess?: (payment: any) => void;
  onError?: (error: any) => void;
}

export default function PaymentWidget({ 
  productId, 
  apiKey,
  onSuccess,
  onError 
}: PaymentWidgetProps) {
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [email, setEmail] = useState('');
  const [walletConnected, setWalletConnected] = useState(false);

  useEffect(() => {
    fetchProduct();
    checkWalletConnection();
  }, [productId]);

  const fetchProduct = async () => {
    try {
      const response = await fetch(`/api/products/${productId}`);
      if (response.ok) {
        const data = await response.json();
        setProduct(data.product);
      } else {
        setError('Product not found');
      }
    } catch (err) {
      setError('Failed to load product');
    } finally {
      setLoading(false);
    }
  };

  const checkWalletConnection = async () => {
    // Check if Solana wallet is available (Phantom, Solflare, etc)
    if (typeof window !== 'undefined' && (window as any).solana) {
      const provider = (window as any).solana;
      if (provider.isConnected && provider.publicKey) {
        setWalletAddress(provider.publicKey.toString());
        setWalletConnected(true);
      }
    }
  };

  const connectWallet = async () => {
    try {
      if (!(window as any).solana) {
        setError('Please install a Solana wallet (Phantom, Solflare, etc)');
        return;
      }

      const provider = (window as any).solana;
      const response = await provider.connect();
      setWalletAddress(response.publicKey.toString());
      setWalletConnected(true);
      setError(null);
    } catch (err: any) {
      setError('Failed to connect wallet: ' + err.message);
    }
  };

  const handlePayment = async () => {
    if (!walletConnected) {
      await connectWallet();
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      // 1. Create payment session
      const sessionResponse = await fetch('/api/payments/create-session', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(apiKey && { 'X-API-Key': apiKey })
        },
        body: JSON.stringify({
          productId,
          customerWallet: walletAddress,
          customerEmail: email || undefined,
        }),
      });

      if (!sessionResponse.ok) {
        throw new Error('Failed to create payment session');
      }

      const sessionData = await sessionResponse.json();
      const { session, transaction } = sessionData;

      // 2. Sign transaction with wallet
      const provider = (window as any).solana;
      const transactionBuffer = Buffer.from(transaction, 'base64');
      
      const signedTransaction = await provider.signTransaction(
        // Convert buffer to Transaction object (wallet adapter handles this)
        transactionBuffer
      );

      // 3. Send signed transaction
      const sendResponse = await fetch('/api/payments/send-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          signedTransaction: signedTransaction.serialize().toString('base64'),
        }),
      });

      if (!sendResponse.ok) {
        throw new Error('Failed to send transaction');
      }

      const sendData = await sendResponse.json();

      // 4. Wait for confirmation
      const confirmResponse = await fetch('/api/payments/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          txSignature: sendData.signature,
        }),
      });

      if (!confirmResponse.ok) {
        throw new Error('Payment confirmation failed');
      }

      const confirmData = await confirmResponse.json();

      setSuccess(true);
      if (onSuccess) {
        onSuccess(confirmData.payment);
      }
    } catch (err: any) {
      setError(err.message);
      if (onError) {
        onError(err);
      }
    } finally {
      setProcessing(false);
    }
  };

  const formatPrice = (price: string, decimals: number = 6) => {
    const num = parseFloat(price) / Math.pow(10, decimals);
    return num.toFixed(2);
  };

  if (loading) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
        </CardContent>
      </Card>
    );
  }

  if (success) {
    return (
      <Card className="w-full max-w-md mx-auto border-green-200 bg-green-50">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <CheckCircle className="h-16 w-16 text-green-600 mb-4" />
          <h3 className="text-2xl font-bold text-green-900 mb-2">
            Payment Successful!
          </h3>
          <p className="text-green-700 text-center">
            Your payment has been confirmed on-chain.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!product) {
    return (
      <Card className="w-full max-w-md mx-auto border-red-200 bg-red-50">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <XCircle className="h-16 w-16 text-red-600 mb-4" />
          <h3 className="text-xl font-bold text-red-900 mb-2">
            Product Not Found
          </h3>
          <p className="text-red-700">The requested product does not exist.</p>
        </CardContent>
      </Card>
    );
  }

  const totalPrice = formatPrice(
    (BigInt(product.price) + BigInt(1000000)).toString(),
    product.tokenDecimals
  );

  return (
    <Card className="w-full max-w-md mx-auto shadow-lg">
      <CardHeader className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          Secure Checkout
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        {/* Product Info */}
        <div className="space-y-2">
          {product.imageUrl && (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-48 object-cover rounded-lg"
            />
          )}
          <h3 className="text-xl font-bold">{product.name}</h3>
          {product.description && (
            <p className="text-gray-600 text-sm">{product.description}</p>
          )}
        </div>

        {/* Pricing Breakdown */}
        <div className="space-y-2 border-t border-b py-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Product Price</span>
            <span className="font-medium">
              ${formatPrice(product.price, product.tokenDecimals)} USDC
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Platform Fee</span>
            <span className="font-medium">$1.00 USDC</span>
          </div>
          <div className="flex justify-between text-lg font-bold">
            <span>Total</span>
            <span className="text-orange-600">${totalPrice} USDC</span>
          </div>
        </div>

        {/* Customer Info */}
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Email (optional)
            </label>
            <Input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={processing}
            />
          </div>

          {walletConnected && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-900">
                  Wallet Connected
                </span>
              </div>
              <p className="text-xs text-green-700 mt-1 font-mono">
                {walletAddress.substring(0, 8)}...{walletAddress.substring(walletAddress.length - 8)}
              </p>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Payment Button */}
        <Button
          className="w-full bg-orange-600 hover:bg-orange-700 text-white py-6 text-lg"
          onClick={handlePayment}
          disabled={processing}
        >
          {processing ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Processing Payment...
            </>
          ) : walletConnected ? (
            <>
              <DollarSign className="mr-2 h-5 w-5" />
              Pay ${totalPrice} USDC
            </>
          ) : (
            <>
              <Wallet className="mr-2 h-5 w-5" />
              Connect Wallet to Pay
            </>
          )}
        </Button>

        {/* Security Badge */}
        <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
          <Shield className="h-4 w-4 text-green-600" />
          <span>Secured by Solana blockchain</span>
        </div>

        {/* Merchant Info */}
        <div className="text-center text-xs text-gray-500">
          Powered by {product.organization.name}
        </div>
      </CardContent>
    </Card>
  );
}
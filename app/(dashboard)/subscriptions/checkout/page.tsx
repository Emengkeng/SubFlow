'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, CheckCircle2, AlertCircle, Shield, Zap, XCircle } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

function formatUSDC(amount: string): string {
  return `$${(Number(amount) / 1_000_000).toFixed(2)}`;
}

type CheckoutStep = 'loading' | 'review' | 'signing' | 'confirming' | 'success' | 'error';

export default function CheckoutPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const planId = searchParams.get('planId');

  const [step, setStep] = useState<CheckoutStep>('loading');
  const [planData, setPlanData] = useState<any>(null);
  const [approvalData, setApprovalData] = useState<any>(null);
  const [subscriptionId, setSubscriptionId] = useState<string>('');
  const [error, setError] = useState<string>('');

  // TODO: Get wallet from your Solana wallet context
  const walletAddress = 'YOUR_WALLET_ADDRESS';
  const isWalletConnected = !!walletAddress;

  useEffect(() => {
    if (!planId || !isWalletConnected) {
      setError(!planId ? 'No plan selected' : 'Please connect your wallet');
      setStep('error');
      return;
    }

    initiateCheckout();
  }, [planId, isWalletConnected]);

  const initiateCheckout = async () => {
    try {
      setStep('loading');
      const response = await fetch('/api/subscriptions/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          userWallet: walletAddress,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to initiate checkout');
      }

      const data = await response.json();
      setPlanData(data.plan);
      setApprovalData(data.approval);
      setSubscriptionId(data.subscriptionId);
      setStep('review');
    } catch (err: any) {
      setError(err.message);
      setStep('error');
    }
  };

  const handleApproveAndSubscribe = async () => {
    try {
      setStep('signing');

      // TODO: Integrate with your Solana wallet
      // 1. Decode the base64 transaction
      // 2. Have user sign it
      // 3. Send to Solana network
      // 4. Get signature

      // Example (pseudo-code):
      // const transaction = Transaction.from(Buffer.from(approvalData.transaction, 'base64'));
      // const signed = await wallet.signTransaction(transaction);
      // const signature = await connection.sendRawTransaction(signed.serialize());
      // await connection.confirmTransaction(signature);

      const mockSignature = 'MOCK_SIGNATURE_' + Date.now(); // Replace with actual

      setStep('confirming');

      // Confirm subscription
      const response = await fetch('/api/subscriptions/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptionId,
          signature: mockSignature,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to confirm subscription');
      }

      setStep('success');
    } catch (err: any) {
      setError(err.message);
      setStep('error');
    }
  };

  if (step === 'loading') {
    return (
      <section className="flex-1 p-4 lg:p-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardContent className="p-12 text-center">
              <Loader2 className="size-12 animate-spin text-orange-500 mx-auto mb-4" />
              <p className="text-muted-foreground">Loading checkout...</p>
            </CardContent>
          </Card>
        </div>
      </section>
    );
  }

  if (step === 'error') {
    return (
      <section className="flex-1 p-4 lg:p-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardContent className="p-12 text-center">
              <XCircle className="size-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Checkout Failed</h3>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={() => router.back()}>Go Back</Button>
            </CardContent>
          </Card>
        </div>
      </section>
    );
  }

  if (step === 'success') {
    return (
      <section className="flex-1 p-4 lg:p-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardContent className="p-12 text-center">
              <div className="mb-6">
                <div className="size-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="size-8 text-green-600" />
                </div>
                <h3 className="text-2xl font-bold mb-2">Subscription Activated! 🎉</h3>
                <p className="text-muted-foreground">
                  Your first payment has been processed and your subscription is now active.
                </p>
              </div>

              <div className="bg-muted p-4 rounded-lg mb-6 text-left">
                <h4 className="font-semibold mb-3">What's Next?</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start">
                    <CheckCircle2 className="size-4 mr-2 mt-0.5 text-green-600 shrink-0" />
                    <span>Access your subscription features immediately</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="size-4 mr-2 mt-0.5 text-green-600 shrink-0" />
                    <span>Automatic payments every billing cycle</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="size-4 mr-2 mt-0.5 text-green-600 shrink-0" />
                    <span>Cancel anytime from your subscriptions page</span>
                  </li>
                </ul>
              </div>

              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={() => router.push('/dashboard/subscriptions')}>
                  View Subscriptions
                </Button>
                <Button 
                  className="bg-orange-500 hover:bg-orange-600"
                  onClick={() => router.push('/dashboard/subscriptions/browse')}
                >
                  Browse More Plans
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    );
  }

  // Review and Signing steps
  const pricing = planData ? {
    merchant: formatUSDC((BigInt(planData.amount) - BigInt(1_000_000)).toString()),
    platform: '$1.00',
    total: formatUSDC(planData.amount)
  } : null;

  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">Complete Subscription</h1>
          <p className="text-muted-foreground">
            Review and approve your subscription
          </p>
        </div>

        {/* Step Indicator */}
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
            step === 'review' ? 'bg-orange-100 text-orange-700' : 
            ['signing', 'confirming'].includes(step) ? 'bg-green-100 text-green-700' : 
            'bg-gray-100 text-gray-500'
          }`}>
            <div className={`size-2 rounded-full ${
              step === 'review' ? 'bg-orange-500' : 
              ['signing', 'confirming'].includes(step) ? 'bg-green-500' : 
              'bg-gray-400'
            }`} />
            Review
          </div>
          <div className="w-8 h-0.5 bg-gray-200" />
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
            step === 'signing' ? 'bg-orange-100 text-orange-700' : 
            step === 'confirming' ? 'bg-green-100 text-green-700' : 
            'bg-gray-100 text-gray-500'
          }`}>
            <div className={`size-2 rounded-full ${
              step === 'signing' ? 'bg-orange-500' : 
              step === 'confirming' ? 'bg-green-500' : 
              'bg-gray-400'
            }`} />
            Sign
          </div>
          <div className="w-8 h-0.5 bg-gray-200" />
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
            step === 'confirming' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'
          }`}>
            <div className={`size-2 rounded-full ${
              step === 'confirming' ? 'bg-orange-500' : 'bg-gray-400'
            }`} />
            Confirm
          </div>
        </div>

        {/* Main Content */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Subscription Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Plan Info */}
            <div className="flex items-center gap-4 pb-6 border-b">
              <Avatar className="size-16">
                <AvatarImage src={planData?.merchant?.logo} alt={planData?.merchant} />
                <AvatarFallback>
                  {planData?.merchant?.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">{planData?.merchant}</p>
                <h3 className="text-xl font-bold">{planData?.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {planData?.billingPeriod}
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">{pricing?.total}</div>
                <p className="text-sm text-muted-foreground">per billing</p>
              </div>
            </div>

            {/* Pricing Breakdown */}
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Service fee</span>
                <span className="font-medium">{pricing?.merchant}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Platform fee</span>
                <span className="font-medium">{pricing?.platform}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t">
                <span className="font-medium">Total per billing</span>
                <span className="font-bold">{pricing?.total}</span>
              </div>
            </div>

            {/* Features */}
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Shield className="size-5 text-green-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Secure & Safe</p>
                  <p className="text-sm text-muted-foreground">
                    Token delegation with spending limits. Cancel anytime.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Zap className="size-5 text-orange-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Gas-Free Transactions</p>
                  <p className="text-sm text-muted-foreground">
                    Platform sponsors all transaction fees. No additional costs.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="size-5 text-blue-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Immediate Access</p>
                  <p className="text-sm text-muted-foreground">
                    First payment processed immediately upon approval.
                  </p>
                </div>
              </div>
            </div>

            {/* Important Notice */}
            <Alert>
              <AlertCircle className="size-4" />
              <AlertTitle>Important Notice</AlertTitle>
              <AlertDescription className="text-sm">
                By approving this subscription, you authorize automatic recurring payments
                of {pricing?.total} every {planData?.billingPeriod}. You will be charged
                immediately upon approval.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={() => router.back()}
            disabled={['signing', 'confirming'].includes(step)}
          >
            Cancel
          </Button>
          <Button 
            className="flex-1 bg-orange-500 hover:bg-orange-600"
            onClick={handleApproveAndSubscribe}
            disabled={['signing', 'confirming'].includes(step)}
          >
            {step === 'signing' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing Transaction...
              </>
            ) : step === 'confirming' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing Payment...
              </>
            ) : (
              'Approve & Subscribe'
            )}
          </Button>
        </div>

        {/* Security Note */}
        <p className="text-center text-xs text-muted-foreground mt-4">
          Your wallet will prompt you to approve the transaction. Only approve if the details above are correct.
        </p>
      </div>
    </section>
  );
}
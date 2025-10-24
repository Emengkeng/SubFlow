'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Connection, VersionedTransaction } from '@solana/web3.js';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Calendar, Building2, CheckCircle, AlertCircle, 
  Loader2, ArrowLeft, ExternalLink, DollarSign, Clock, Shield
} from 'lucide-react';

type SubscriptionPlan = {
  id: string;
  name: string;
  description: string | null;
  amountPerBilling: string;
  displayAmount: string;
  billingPeriodDays: number;
  billingDescription: string;
  imageUrl: string | null;
  tokenMint: string;
  tokenDecimals: number;
  maxPayments: number | null;
  merchantTokenAccount: string;
  isActive: boolean;
  organization: {
    id: string;
    name: string;
    logoUrl: string | null;
    website: string | null;
  };
};

const PLATFORM_FEE = 1.0;

export default function SubscriptionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { publicKey, signTransaction, connected, sendTransaction } = useWallet();
  
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'details' | 'confirming' | 'success'>('details');
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [approvalInstructions, setApprovalInstructions] = useState<string | null>(null);

  const subscribeInProgress = useRef(false);
  const planId = params.planId as string;

  useEffect(() => {
    if (planId) {
      fetchPlan();
    }
  }, [planId]);

  const fetchPlan = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/plans/${planId}`);
      
      if (!response.ok) {
        throw new Error('Plan not found');
      }

      const data = await response.json();
      setPlan(data.plan);
    } catch (err: any) {
      console.error('Fetch plan error:', err);
      setError(err.message || 'Failed to load plan');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    if (subscribeInProgress.current) {
      console.log('⚠️ Subscribe already in progress');
      return;
    }

    if (!connected || !publicKey || !signTransaction) {
      setError('Please connect your wallet first');
      return;
    }

    if (!plan?.isActive) {
      setError('This plan is currently unavailable');
      return;
    }

    subscribeInProgress.current = true;
    setProcessing(true);
    setError(null);

    try {
      console.log('🚀 Starting subscription flow...');

      // Step 1: Initiate subscription
      console.log('📝 Creating subscription...');
      const initiateResponse = await fetch('/api/subscriptions/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: plan.id,
          userWallet: publicKey.toString(),
          email: email || undefined,
        }),
      });

      if (!initiateResponse.ok) {
        const errorData = await initiateResponse.json();
        throw new Error(errorData.error || 'Failed to initiate subscription');
      }

      const initiateData = await initiateResponse.json();
      setSubscriptionId(initiateData.subscriptionId);
      setApprovalInstructions(initiateData.approval.instructions);
      console.log('✅ Subscription initiated:', initiateData.subscriptionId);

      // Step 2: User signs delegation approval
      console.log('📦 Deserializing approval transaction...');
      const transactionBuffer = Buffer.from(initiateData.approval.transaction, 'base64');
      const transaction = VersionedTransaction.deserialize(transactionBuffer);

      console.log('🔐 Requesting delegation approval...');
      console.log('⏳ Please approve delegation in your wallet...');

      // Step 3: Send approval transaction
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

      console.log('✅ Approval transaction sent:', signature);

      // Wait for confirmation
      console.log('⏳ Waiting for approval confirmation...');
      const confirmation = await connection.confirmTransaction(signature, 'confirmed');

      if (confirmation.value.err) {
        throw new Error(`Approval failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      console.log('✅ Approval confirmed on-chain!');

      // Step 4: Confirm subscription (backend verifies and processes first payment)
      setStep('confirming');
      console.log('💰 Confirming subscription and processing first payment...');

      const confirmResponse = await fetch('/api/subscriptions/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptionId: initiateData.subscriptionId,
          signature: signature,
        }),
      });

      if (!confirmResponse.ok) {
        const errorData = await confirmResponse.json();
        throw new Error(errorData.error || 'Failed to confirm subscription');
      }

      const confirmData = await confirmResponse.json();
      setTxSignature(confirmData.firstPayment.txSignature);
      console.log('✅ Subscription confirmed! First payment:', confirmData.firstPayment.txSignature);

      setStep('success');

    } catch (err: any) {
      console.error('❌ Subscription failed:', err);
      
      let errorMessage = 'Subscription failed. Please try again.';
      
      if (err.message?.includes('User rejected') || err.message?.includes('rejected')) {
        errorMessage = 'Subscription was cancelled.';
      } else if (err.message?.includes('insufficient')) {
        errorMessage = 'Insufficient balance in your wallet.';
      } else if (err.message?.includes('already have an active')) {
        errorMessage = 'You already have an active subscription to this plan.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setStep('details');
    } finally {
      setProcessing(false);
      subscribeInProgress.current = false;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <AlertCircle className="h-16 w-16 text-gray-400 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Plan Not Found</h2>
        <p className="text-gray-600 mb-6">The subscription plan doesn't exist.</p>
        <Button onClick={() => router.push('/subscriptions')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Plans
        </Button>
      </div>
    );
  }

  const planPrice = parseFloat(plan.displayAmount.replace('$', ''));
  const totalPrice = planPrice + PLATFORM_FEE;

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Subscription Active! 🎉</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-gray-600">
              Your subscription has been activated and the first payment was processed successfully.
            </p>
            
            {txSignature && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-2">First Payment Transaction:</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs text-gray-600 break-all flex-1">
                    {txSignature}
                  </code>
                  <a
                    href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 flex-shrink-0"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            )}

            <Separator />

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Plan:</span>
                <span className="font-medium">{plan.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Amount:</span>
                <span className="font-medium">${totalPrice.toFixed(2)} USDC</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Billing:</span>
                <span className="font-medium">{plan.billingDescription}</span>
              </div>
            </div>

            <Alert className="bg-blue-50 border-blue-200">
              <AlertDescription className="text-sm text-blue-900">
                Future payments will be processed automatically. You can cancel anytime from your dashboard.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => router.push('/dashboard/subscriptions')}
            >
              View Subscriptions
            </Button>
            <Button
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              onClick={() => router.push('/subscriptions')}
            >
              Browse More
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <Button
          variant="ghost"
          onClick={() => router.push('/subscriptions')}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Plans
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Plan Details */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100">
                <div className="flex items-center gap-3 mb-4">
                  {plan.organization.logoUrl ? (
                    <img
                      src={plan.organization.logoUrl}
                      alt={plan.organization.name}
                      className="h-12 w-12 rounded-full"
                    />
                  ) : (
                    <Building2 className="h-12 w-12 text-gray-400" />
                  )}
                  <div>
                    <p className="text-sm text-gray-600">{plan.organization.name}</p>
                    {plan.organization.website && (
                      <a
                        href={plan.organization.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                      >
                        Visit website
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>

                <CardTitle className="text-3xl mb-2">{plan.name}</CardTitle>
                
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-blue-600">
                    {plan.displayAmount}
                  </span>
                  <span className="text-gray-600">USDC</span>
                  <span className="text-lg text-gray-500">
                    / {plan.billingPeriodDays} days
                  </span>
                </div>
              </CardHeader>

              <CardContent className="pt-6 space-y-6">
                {plan.description && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
                    <p className="text-gray-600 leading-relaxed">{plan.description}</p>
                  </div>
                )}

                <Separator />

                <div>
                  <h3 className="font-semibold text-gray-900 mb-4">What's Included</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-start gap-3">
                      <Calendar className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-gray-900">Recurring Billing</p>
                        <p className="text-sm text-gray-600">{plan.billingDescription}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <DollarSign className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-gray-900">Auto-Payments</p>
                        <p className="text-sm text-gray-600">Charged automatically</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-gray-900">Cancel Anytime</p>
                        <p className="text-sm text-gray-600">From your dashboard</p>
                      </div>
                    </div>

                    {plan.maxPayments && (
                      <div className="flex items-start gap-3">
                        <Clock className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div>
                          <p className="font-medium text-gray-900">Limited Duration</p>
                          <p className="text-sm text-gray-600">Up to {plan.maxPayments} payments</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Subscription Form */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Subscribe Now</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {step === 'confirming' && (
                  <Alert className="bg-blue-50 border-blue-200">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    <AlertDescription className="text-blue-900 ml-2">
                      Processing first payment...
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email (optional)</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={processing}
                  />
                  <p className="text-xs text-gray-500">
                    For payment notifications
                  </p>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Plan Price:</span>
                    <span className="font-medium">${planPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Platform Fee:</span>
                    <span className="font-medium">${PLATFORM_FEE.toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="font-bold">First Payment:</span>
                    <span className="font-bold text-blue-600">
                      ${totalPrice.toFixed(2)} USDC
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    * Then ${totalPrice.toFixed(2)} {plan.billingDescription.toLowerCase()}
                  </p>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Alert className="bg-amber-50 border-amber-200">
                  <AlertDescription className="text-sm text-amber-900">
                    You'll be charged immediately, then automatically {plan.billingDescription.toLowerCase()}.
                  </AlertDescription>
                </Alert>
              </CardContent>

              <CardFooter className="flex-col gap-3">
                {!connected && (
                  <WalletMultiButton className="w-full" />
                )}

                <Button
                  onClick={handleSubscribe}
                  disabled={!connected || processing || !plan.isActive}
                  className="w-full bg-blue-600 hover:bg-blue-700 h-12"
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      {step === 'confirming' ? 'Processing...' : 'Subscribing...'}
                    </>
                  ) : (
                    `Subscribe - ${totalPrice.toFixed(2)} USDC`
                  )}
                </Button>

                {connected && (
                  <p className="text-xs text-center text-gray-500">
                    Connected: {publicKey?.toString().slice(0, 8)}...
                  </p>
                )}
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
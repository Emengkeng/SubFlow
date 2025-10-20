'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, Calendar, DollarSign, Check, Wallet, Loader2 } from 'lucide-react';
import useSWR from 'swr';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Plan {
  id: string;
  name: string;
  description: string;
  amountPerBilling: string;
  billingPeriodDays: number;
  organization: {
    id: string;
    name: string;
    logoUrl: string;
  };
}

interface Pricing {
  merchant: string;
  platform: string;
  total: string;
}

function formatUSDC(amount: string): Pricing {
  const total = Number(amount) / 1_000_000;
  const merchantAmount = total - 1;
  return {
    merchant: `$${merchantAmount.toFixed(2)}`,
    platform: '$1.00',
    total: `$${total.toFixed(2)}`
  };
}

function PlanCard({ 
  plan, 
  onSubscribe, 
  isWalletConnected 
}: { 
  plan: Plan; 
  onSubscribe: (planId: string) => void;
  isWalletConnected: boolean;
}) {
  const pricing = formatUSDC(plan.amountPerBilling);
  
  return (
    <Card className="flex flex-col h-full hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-center space-x-3 mb-2">
          <Avatar className="size-10">
            <AvatarImage src={plan.organization.logoUrl} alt={plan.organization.name} />
            <AvatarFallback>
              {plan.organization.name.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm text-muted-foreground">{plan.organization.name}</p>
            <CardTitle className="text-lg">{plan.name}</CardTitle>
          </div>
        </div>
        <CardDescription className="line-clamp-2">{plan.description}</CardDescription>
      </CardHeader>
      
      <CardContent className="flex-1">
        <div className="space-y-3">
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold">{pricing.total}</span>
            <span className="text-muted-foreground">/ {plan.billingPeriodDays} days</span>
          </div>
          
          <div className="bg-muted p-3 rounded-lg space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Service</span>
              <span className="font-medium">{pricing.merchant}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Platform fee</span>
              <span className="font-medium">{pricing.platform}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground pt-1 border-t">
              <span>✓ No gas fees</span>
              <span>Platform sponsored</span>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <div className="flex items-center text-sm">
              <Calendar className="size-4 mr-2 text-muted-foreground" />
              <span>Billed every {plan.billingPeriodDays} days</span>
            </div>
            <div className="flex items-center text-sm">
              <Check className="size-4 mr-2 text-green-600" />
              <span>Cancel anytime</span>
            </div>
          </div>
        </div>
      </CardContent>
      
      <CardFooter>
        {isWalletConnected ? (
          <Button 
            className="w-full bg-orange-500 hover:bg-orange-600"
            onClick={() => onSubscribe(plan.id)}
          >
            Subscribe Now
          </Button>
        ) : (
          <Button 
            className="w-full"
            variant="outline"
            onClick={() => alert('Please connect your wallet to subscribe')}
          >
            Connect Wallet to Subscribe
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

function PlansGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Card key={i} className="animate-pulse h-96">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="size-10 rounded-full bg-gray-200"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-20 bg-gray-200 rounded"></div>
                  <div className="h-5 w-32 bg-gray-200 rounded"></div>
                </div>
              </div>
              <div className="h-4 w-full bg-gray-200 rounded"></div>
              <div className="h-4 w-3/4 bg-gray-200 rounded"></div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function BrowsePlansPage() {
  const [search, setSearch] = useState('');
  const router = useRouter();
  const { publicKey, connected } = useWallet();
  
  const walletAddress = publicKey?.toBase58();
  const isWalletConnected = connected && !!walletAddress;

  const { data, error, isLoading } = useSWR<{ success: boolean; plans: Plan[] }>(
    `/api/plans/search?search=${encodeURIComponent(search)}`,
    fetcher,
    { refreshInterval: 60000 }
  );

  const handleSubscribe = (planId: string) => {
    if (!isWalletConnected) {
      alert('Please connect your wallet first');
      return;
    }
    router.push(`/subscriptions/checkout?planId=${planId}`);
  };

  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-2">Browse Subscription Plans</h1>
          <p className="text-muted-foreground">
            Discover and subscribe to services across different organizations
          </p>
        </div>
        <WalletMultiButton className="!bg-orange-500 hover:!bg-orange-600" />
      </div>

      {/* Wallet Connection Alert */}
      {!isWalletConnected && (
        <Card className="mb-6 bg-orange-50 border-orange-200">
          <CardContent className="p-4 flex items-center gap-3">
            <Wallet className="size-5 text-orange-600" />
            <div className="flex-1">
              <p className="font-medium text-orange-900">Connect your wallet to subscribe</p>
              <p className="text-sm text-orange-700">You need a connected Solana wallet to subscribe to plans</p>
            </div>
            <WalletMultiButton className="!bg-orange-600 hover:!bg-orange-700" />
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search plans..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Plans Grid */}
      {isLoading ? (
        <PlansGridSkeleton />
      ) : error ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-red-500">Failed to load plans</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => window.location.reload()}
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      ) : !data?.plans?.length ? (
        <Card>
          <CardContent className="p-12 text-center">
            <DollarSign className="size-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No plans found</h3>
            <p className="text-muted-foreground">
              {search ? 'Try a different search term' : 'No subscription plans available yet'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Found {data.plans.length} plan{data.plans.length !== 1 ? 's' : ''}
            </p>
            {isWalletConnected && (
              <Badge variant="outline" className="gap-1">
                <Check className="size-3" />
                Wallet Connected
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.plans.map((plan) => (
              <PlanCard 
                key={plan.id} 
                plan={plan} 
                onSubscribe={handleSubscribe}
                isWalletConnected={isWalletConnected}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
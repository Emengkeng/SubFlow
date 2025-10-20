'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  CreditCard, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  MoreVertical,
  ExternalLink,
  XCircle,
  CheckCircle2,
  Clock,
  AlertCircle,
  Wallet
} from 'lucide-react';
import useSWR from 'swr';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Subscription {
  id: string;
  status: string;
  nextBillingDate: string;
  createdAt: string;
  amount: string;
  planName: string;
  planDescription: string;
  billingPeriodDays: number;
  merchantName: string;
  merchantLogo: string;
  totalPayments: number;
  totalSpent: string;
}

interface DashboardData {
  subscriptions: Subscription[];
  stats: {
    subscriptionsByStatus: Array<{ status: string; count: number }>;
    totalSpent: string;
    totalPayments: number;
  };
  upcomingPayments: Array<{
    subscriptionId: string;
    organizationName: string;
    planName: string;
    amount: string;
    dueDate: string;
    daysUntilDue: number;
  }>;
  monthlyRecurring: {
    monthlyTotal: string;
    subscriptionCount: number;
  };
  organizations: Array<{
    id: string;
    name: string;
    logoUrl: string;
    activeSubscriptions: number;
  }>;
}

function SubscriptionsSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="animate-pulse">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="size-12 rounded-full bg-gray-200"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 bg-gray-200 rounded"></div>
                <div className="h-3 w-24 bg-gray-200 rounded"></div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { variant: any; icon: any; label: string }> = {
    active: { variant: 'default', icon: CheckCircle2, label: 'Active' },
    paused: { variant: 'secondary', icon: Clock, label: 'Paused' },
    cancelled: { variant: 'destructive', icon: XCircle, label: 'Cancelled' },
    pending_approval: { variant: 'outline', icon: AlertCircle, label: 'Pending' },
  };

  const config = variants[status] || variants.active;
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon className="size-3" />
      {config.label}
    </Badge>
  );
}

function formatUSDC(amount: string): string {
  return `$${(Number(amount) / 1_000_000).toFixed(2)}`;
}

function SubscriptionCard({ 
  subscription, 
  walletAddress 
}: { 
  subscription: Subscription;
  walletAddress: string;
}) {
  const [cancelling, setCancelling] = useState(false);

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this subscription?')) return;
    
    setCancelling(true);
    try {
      const response = await fetch(`/api/subscriptions/${subscription.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userWallet: walletAddress }),
      });

      if (response.ok) {
        alert('Subscription cancelled successfully');
        window.location.reload();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to cancel subscription');
      }
    } catch (error) {
      alert('An error occurred');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-4 flex-1">
            <Avatar className="size-12">
              <AvatarImage src={subscription.merchantLogo} alt={subscription.merchantName} />
              <AvatarFallback>
                {subscription.merchantName.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-lg truncate">
                  {subscription.planName}
                </h3>
                <StatusBadge status={subscription.status} />
              </div>
              
              <p className="text-sm text-muted-foreground mb-2">
                {subscription.merchantName}
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Amount</p>
                  <p className="font-medium">{formatUSDC(subscription.amount)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Frequency</p>
                  <p className="font-medium">Every {subscription.billingPeriodDays} days</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Next Billing</p>
                  <p className="font-medium">
                    {subscription.status === 'active' 
                      ? formatDistanceToNow(new Date(subscription.nextBillingDate), { addSuffix: true })
                      : 'N/A'
                    }
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Paid</p>
                  <p className="font-medium">{formatUSDC(subscription.totalSpent)}</p>
                </div>
              </div>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/subscriptions/${subscription.id}`}>
                  <ExternalLink className="size-4 mr-2" />
                  View Details
                </Link>
              </DropdownMenuItem>
              {subscription.status === 'active' && (
                <DropdownMenuItem 
                  className="text-red-600"
                  onClick={handleCancel}
                  disabled={cancelling}
                >
                  <XCircle className="size-4 mr-2" />
                  {cancelling ? 'Cancelling...' : 'Cancel Subscription'}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  description 
}: { 
  title: string; 
  value: string; 
  icon: any; 
  description?: string;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">{title}</p>
            <h3 className="text-2xl font-bold">{value}</h3>
            {description && (
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          <div className="size-12 bg-orange-100 rounded-lg flex items-center justify-center">
            <Icon className="size-6 text-orange-600" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function UpcomingPayments({ payments }: { payments: DashboardData['upcomingPayments'] }) {
  if (!payments.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming Payments</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {payments.slice(0, 5).map((payment) => (
            <div key={payment.subscriptionId} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Calendar className="size-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">{payment.organizationName}</p>
                  <p className="text-sm text-muted-foreground">{payment.planName}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium">{formatUSDC(payment.amount)}</p>
                <p className="text-sm text-muted-foreground">
                  in {payment.daysUntilDue} day{payment.daysUntilDue !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SubscriptionsContent({ walletAddress }: { walletAddress: string }) {
  const { data, error, isLoading } = useSWR<{ dashboard: DashboardData }>(
    `/api/user/dashboard?wallet=${walletAddress}`,
    fetcher,
    { refreshInterval: 30000 }
  );

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-red-500">Failed to load subscriptions</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !data) {
    return <SubscriptionsSkeleton />;
  }

  const { dashboard } = data;
  const activeCount = dashboard.stats.subscriptionsByStatus.find(
    s => s.status === 'active'
  )?.count || 0;

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Subscriptions"
          value={activeCount.toString()}
          icon={CheckCircle2}
        />
        <StatCard
          title="Monthly Recurring"
          value={formatUSDC(dashboard.monthlyRecurring.monthlyTotal)}
          icon={TrendingUp}
          description={`${dashboard.monthlyRecurring.subscriptionCount} subscriptions`}
        />
        <StatCard
          title="Total Spent"
          value={formatUSDC(dashboard.stats.totalSpent)}
          icon={DollarSign}
          description={`${dashboard.stats.totalPayments} payments`}
        />
        <StatCard
          title="Organizations"
          value={dashboard.organizations.length.toString()}
          icon={CreditCard}
        />
      </div>

      {/* Upcoming Payments */}
      {dashboard.upcomingPayments.length > 0 && (
        <UpcomingPayments payments={dashboard.upcomingPayments} />
      )}

      {/* All Subscriptions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">My Subscriptions</h2>
          <Button asChild className="bg-orange-500 hover:bg-orange-600">
            <Link href="/subscriptions/browse">
              Browse Plans
            </Link>
          </Button>
        </div>

        {dashboard.subscriptions.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <CreditCard className="size-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No subscriptions yet</h3>
              <p className="text-muted-foreground mb-4">
                Start subscribing to services to see them here
              </p>
              <Button asChild className="bg-orange-500 hover:bg-orange-600">
                <Link href="/subscriptions/browse">
                  Browse Available Plans
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {dashboard.subscriptions.map((subscription) => (
              <SubscriptionCard 
                key={subscription.id} 
                subscription={subscription}
                walletAddress={walletAddress}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SubscriptionsPage() {
  const { publicKey, connected } = useWallet();
  const walletAddress = publicKey?.toBase58();

  if (!connected || !walletAddress) {
    return (
      <section className="flex-1 p-4 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="p-12 text-center">
              <Wallet className="size-12 text-orange-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Connect Your Wallet</h3>
              <p className="text-muted-foreground mb-6">
                Please connect your Solana wallet to view your subscriptions
              </p>
              <WalletMultiButton className="!bg-orange-500 hover:!bg-orange-600" />
            </CardContent>
          </Card>
        </div>
      </section>
    );
  }

  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-2">Subscriptions</h1>
          <p className="text-muted-foreground">
            Manage your recurring payments and subscriptions
          </p>
        </div>
        <WalletMultiButton className="!bg-orange-500 hover:!bg-orange-600" />
      </div>

      <Suspense fallback={<SubscriptionsSkeleton />}>
        <SubscriptionsContent walletAddress={walletAddress} />
      </Suspense>
    </section>
  );
}
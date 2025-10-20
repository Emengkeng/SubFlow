'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  CreditCard, DollarSign, TrendingUp, AlertCircle,
  Users, CheckCircle, XCircle, Clock
} from 'lucide-react';

type Metrics = {
  subscriptions: { status: string; count: number }[];
  payments24h: { status: string; count: number; totalAmount: string }[];
  revenueStats?: {
    totalFees: string;
    totalGasCosts: string;
    netRevenue: string;
    transactionCount: number;
  };
};

export default function OrgOverviewPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/admin/metrics');
      if (response.ok) {
        const data = await response.json();
        setMetrics(data.metrics);
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSubscriptionCount = (status: string) => {
    return metrics?.subscriptions.find(s => s.status === status)?.count || 0;
  };

  const getPaymentStats = (status: string) => {
    return metrics?.payments24h.find(p => p.status === status) || { count: 0, totalAmount: '0' };
  };

  const formatAmount = (amount: string, decimals = 6) => {
    const num = parseFloat(amount) / Math.pow(10, decimals);
    return num.toFixed(2);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
      </div>
    );
  }

  const activeSubscriptions = getSubscriptionCount('active');
  const pendingSubscriptions = getSubscriptionCount('pending_approval');
  const cancelledSubscriptions = getSubscriptionCount('cancelled');
  
  const confirmedPayments = getPaymentStats('confirmed');
  const failedPayments = getPaymentStats('failed');

  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Organization Overview</h1>
        <p className="text-gray-600">Monitor your subscription metrics and performance</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
            <Users className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeSubscriptions}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {pendingSubscriptions} pending approval
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">24h Payments</CardTitle>
            <CreditCard className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{confirmedPayments.count}</div>
            <p className="text-xs text-muted-foreground mt-1">
              ${formatAmount(confirmedPayments.totalAmount)} processed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {confirmedPayments.count + failedPayments.count > 0
                ? ((confirmedPayments.count / (confirmedPayments.count + failedPayments.count)) * 100).toFixed(1)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Last 24 hours
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Payments</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{failedPayments.count}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Requires attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Subscription Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Subscription Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium">Active</span>
                </div>
                <span className="text-2xl font-bold text-green-600">
                  {activeSubscriptions}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-yellow-600" />
                  <span className="text-sm font-medium">Pending</span>
                </div>
                <span className="text-2xl font-bold text-yellow-600">
                  {pendingSubscriptions}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-gray-400" />
                  <span className="text-sm font-medium">Cancelled</span>
                </div>
                <span className="text-2xl font-bold text-gray-400">
                  {cancelledSubscriptions}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Payment Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium">Confirmed</span>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-green-600">
                    {confirmedPayments.count}
                  </div>
                  <div className="text-xs text-gray-500">
                    ${formatAmount(confirmedPayments.totalAmount)}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <span className="text-sm font-medium">Failed</span>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-red-600">
                    {failedPayments.count}
                  </div>
                  <div className="text-xs text-gray-500">
                    ${formatAmount(failedPayments.totalAmount)}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a
              href="/dashboard/org/plans"
              className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <CreditCard className="h-8 w-8 text-orange-600 mb-2" />
              <h3 className="font-medium mb-1">Create Plan</h3>
              <p className="text-sm text-gray-600">Add a new subscription plan</p>
            </a>
            
            <a
              href="/dashboard/org/payments"
              className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <DollarSign className="h-8 w-8 text-orange-600 mb-2" />
              <h3 className="font-medium mb-1">View Payments</h3>
              <p className="text-sm text-gray-600">Check payment history</p>
            </a>
            
            <a
              href="/dashboard/org/revenue"
              className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <TrendingUp className="h-8 w-8 text-orange-600 mb-2" />
              <h3 className="font-medium mb-1">Revenue Analytics</h3>
              <p className="text-sm text-gray-600">View detailed statistics</p>
            </a>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
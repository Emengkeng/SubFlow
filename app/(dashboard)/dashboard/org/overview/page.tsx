'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  ShoppingCart, DollarSign, TrendingUp, AlertCircle,
  CheckCircle, XCircle, Clock, Package
} from 'lucide-react';

type Metrics = {
  products: { total: number; active: number };
  payments: {
    allTime: { status: string; count: number; totalAmount: string }[];
    last24h: { status: string; count: number; totalAmount: string }[];
  };
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
      const orgId = localStorage.getItem('currentOrgId');
      const response = await fetch(`/api/organizations/${orgId}/metrics`);
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

  const getPaymentCount = (status: string, period: 'allTime' | 'last24h' = 'allTime') => {
    return metrics?.payments[period].find(p => p.status === status)?.count || 0;
  };

  const getPaymentAmount = (status: string, period: 'allTime' | 'last24h' = 'allTime') => {
    return metrics?.payments[period].find(p => p.status === status)?.totalAmount || '0';
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

  const confirmedPayments = getPaymentCount('confirmed');
  const pendingPayments = getPaymentCount('pending');
  const failedPayments = getPaymentCount('failed');
  
  const confirmed24h = getPaymentCount('confirmed', 'last24h');
  const failed24h = getPaymentCount('failed', 'last24h');
  const totalRevenue = formatAmount(getPaymentAmount('confirmed'));

  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Organization Overview</h1>
        <p className="text-gray-600">Monitor your payment metrics and performance</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.products.total || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics?.products.active || 0} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${totalRevenue}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {confirmedPayments} confirmed payments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">24h Payments</CardTitle>
            <ShoppingCart className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{confirmed24h}</div>
            <p className="text-xs text-muted-foreground mt-1">
              ${formatAmount(getPaymentAmount('confirmed', 'last24h'))} volume
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
              {confirmed24h + failed24h > 0
                ? ((confirmed24h / (confirmed24h + failed24h)) * 100).toFixed(1)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Last 24 hours
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Payment Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Payment Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium">Confirmed</span>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-600">
                    {confirmedPayments}
                  </div>
                  <div className="text-xs text-gray-500">
                    ${totalRevenue}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-yellow-600" />
                  <span className="text-sm font-medium">Pending</span>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-yellow-600">
                    {pendingPayments}
                  </div>
                  <div className="text-xs text-gray-500">
                    ${formatAmount(getPaymentAmount('pending'))}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <span className="text-sm font-medium">Failed</span>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-red-600">
                    {failedPayments}
                  </div>
                  <div className="text-xs text-gray-500">
                    ${formatAmount(getPaymentAmount('failed'))}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium">Successful</span>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-green-600">
                    {confirmed24h}
                  </div>
                  <div className="text-xs text-gray-500">
                    ${formatAmount(getPaymentAmount('confirmed', 'last24h'))}
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
                    {failed24h}
                  </div>
                  <div className="text-xs text-gray-500">
                    ${formatAmount(getPaymentAmount('failed', 'last24h'))}
                  </div>
                </div>
              </div>

              {failed24h > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm font-medium text-yellow-900">
                      {failed24h} failed payment{failed24h > 1 ? 's' : ''} in last 24h
                    </span>
                  </div>
                </div>
              )}
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
              href="/dashboard/org/products"
              className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Package className="h-8 w-8 text-orange-600 mb-2" />
              <h3 className="font-medium mb-1">Create Product</h3>
              <p className="text-sm text-gray-600">Add a new product for sale</p>
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

      {/* Integration Info */}
      <Card className="mt-6 bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-900">Getting Started</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-blue-800">
            <p className="font-medium">How to accept payments:</p>
            <ol className="list-decimal list-inside space-y-2 ml-2">
              <li>Create a product in the Products section</li>
              <li>Copy the product ID or widget URL</li>
              <li>Embed the payment widget on your website</li>
              <li>Customers pay with their Solana wallet</li>
              <li>Receive instant payment notifications via webhooks</li>
            </ol>
            <a
              href="/docs/integration"
              className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium mt-2"
            >
              View Integration Guide →
            </a>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
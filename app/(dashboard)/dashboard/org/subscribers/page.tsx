'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Users, Search, Loader2, AlertCircle, TrendingUp, 
  DollarSign, Calendar, ExternalLink, Download 
} from 'lucide-react';

type Subscriber = {
  id: string;
  userWallet: string;
  userEmail: string | null;
  status: string;
  planName: string;
  amount: string;
  displayAmount: string;
  billingPeriodDays: number;
  nextBillingDate: string;
  totalPayments: number;
  failedPayments: number;
  totalSpent: string;
  createdAt: string;
};

const statusConfig: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: 'bg-green-100 text-green-800' },
  pending_approval: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  paused: { label: 'Paused', color: 'bg-gray-100 text-gray-800' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800' },
  expired: { label: 'Expired', color: 'bg-gray-100 text-gray-800' },
};

export default function OrgSubscribersPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    totalRevenue: 0,
    averageValue: 0,
  });

  useEffect(() => {
    fetchSubscribers();
  }, []);

  useEffect(() => {
    calculateStats();
  }, [subscribers]);

  const fetchSubscribers = async () => {
    try {
      setLoading(true);
      const orgId = localStorage.getItem('currentOrgId');
      
      if (!orgId) {
        throw new Error('No organization selected');
      }

      const response = await fetch(`/api/organizations/${orgId}/subscribers`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch subscribers');
      }

      const data = await response.json();
      setSubscribers(data.subscribers || []);
    } catch (err: any) {
      console.error('Fetch subscribers error:', err);
      setError(err.message || 'Failed to load subscribers');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = () => {
    const active = subscribers.filter(s => s.status === 'active').length;
    const totalRevenue = subscribers.reduce(
      (sum, s) => sum + parseFloat(s.totalSpent),
      0
    );
    const averageValue = subscribers.length > 0 ? totalRevenue / subscribers.length : 0;

    setStats({
      total: subscribers.length,
      active,
      totalRevenue: totalRevenue / 1_000_000,
      averageValue: averageValue / 1_000_000,
    });
  };

  const filteredSubscribers = subscribers.filter((subscriber) => {
    const matchesSearch = 
      subscriber.userWallet.toLowerCase().includes(searchQuery.toLowerCase()) ||
      subscriber.userEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      subscriber.planName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || subscriber.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const exportToCsv = () => {
    const headers = [
      'Wallet',
      'Email',
      'Plan',
      'Status',
      'Amount',
      'Total Payments',
      'Total Spent',
      'Next Billing',
      'Created',
    ];

    const rows = filteredSubscribers.map(s => [
      s.userWallet,
      s.userEmail || 'N/A',
      s.planName,
      s.status,
      s.displayAmount,
      s.totalPayments,
      `$${(parseFloat(s.totalSpent) / 1_000_000).toFixed(2)}`,
      new Date(s.nextBillingDate).toLocaleDateString(),
      new Date(s.createdAt).toLocaleDateString(),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subscribers-${new Date().toISOString()}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Subscribers</h1>
        <p className="text-gray-600 mt-1">Manage and track your subscription customers</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Subscribers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Active</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats.active}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Revenue</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              ${stats.totalRevenue.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Avg. Customer Value</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">
              ${stats.averageValue.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by wallet, email, or plan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending_approval">Pending</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                onClick={exportToCsv}
                disabled={filteredSubscribers.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {filteredSubscribers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {searchQuery || statusFilter !== 'all'
                  ? 'No subscribers found'
                  : 'No subscribers yet'}
              </h3>
              <p className="text-gray-600">
                {searchQuery || statusFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Start by creating a subscription plan'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Total Paid</TableHead>
                    <TableHead>Next Billing</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubscribers.map((subscriber) => (
                    <TableRow key={subscriber.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">
                            {subscriber.userWallet.slice(0, 8)}...
                            {subscriber.userWallet.slice(-6)}
                          </p>
                          {subscriber.userEmail && (
                            <p className="text-xs text-gray-500">{subscriber.userEmail}</p>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{subscriber.planName}</p>
                          <p className="text-xs text-gray-500">
                            Every {subscriber.billingPeriodDays} days
                          </p>
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge className={statusConfig[subscriber.status]?.color || ''}>
                          {statusConfig[subscriber.status]?.label || subscriber.status}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-right font-medium">
                        {subscriber.displayAmount}
                      </TableCell>

                      <TableCell className="text-right">
                        <div>
                          <p className="font-medium">
                            ${(parseFloat(subscriber.totalSpent) / 1_000_000).toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {subscriber.totalPayments} payments
                          </p>
                        </div>
                      </TableCell>

                      <TableCell>
                        {subscriber.status === 'active' ? (
                          <div>
                            <p className="text-sm">
                              {new Date(subscriber.nextBillingDate).toLocaleDateString()}
                            </p>
                            <p className="text-xs text-gray-500">
                              {Math.ceil(
                                (new Date(subscriber.nextBillingDate).getTime() - Date.now()) /
                                (1000 * 60 * 60 * 24)
                              )}{' '}
                              days
                            </p>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">N/A</span>
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            // Open subscriber details in a modal or new page
                            window.open(`/dashboard/org/subscribers/${subscriber.id}`, '_blank');
                          }}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Additional Insights */}
      {subscribers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Monthly Recurring Revenue</span>
                  <span className="text-lg font-bold text-blue-600">
                    $
                    {subscribers
                      .filter(s => s.status === 'active' && s.billingPeriodDays === 30)
                      .reduce((sum, s) => sum + parseFloat(s.amount), 0)
                      .toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Churn Rate</span>
                  <span className="text-lg font-bold text-red-600">
                    {((subscribers.filter(s => s.status === 'cancelled').length / stats.total) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Failed Payments</span>
                  <span className="text-lg font-bold text-orange-600">
                    {subscribers.reduce((sum, s) => sum + s.failedPayments, 0)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Plans</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(
                  subscribers.reduce((acc, s) => {
                    acc[s.planName] = (acc[s.planName] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)
                )
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5)
                  .map(([plan, count]) => (
                    <div key={plan} className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">{plan}</span>
                      <Badge variant="secondary">{count} subscribers</Badge>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
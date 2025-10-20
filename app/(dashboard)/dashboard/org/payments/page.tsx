'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, XCircle, Clock, RefreshCw, 
  ExternalLink, AlertCircle 
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type Payment = {
  id: string;
  subscriptionId: string;
  amount: string;
  status: string;
  txSignature?: string;
  retryCount: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  subscription?: {
    userWallet: string;
    plan?: {
      name: string;
    };
  };
};

export default function OrgPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [failedPayments, setFailedPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      const [failedRes] = await Promise.all([
        fetch('/api/admin/failed-payments'),
      ]);

      if (failedRes.ok) {
        const failedData = await failedRes.json();
        setFailedPayments(failedData.failedPayments || []);
      }
    } catch (error) {
      console.error('Failed to fetch payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (paymentId: string) => {
    setRetrying(paymentId);
    try {
      const response = await fetch(`/api/admin/payments/${paymentId}/retry`, {
        method: 'POST',
      });

      if (response.ok) {
        await fetchPayments();
      }
    } catch (error) {
      console.error('Retry failed:', error);
    } finally {
      setRetrying(null);
    }
  };

  const formatAmount = (amount: string, decimals = 6) => {
    const num = parseFloat(amount) / Math.pow(10, decimals);
    return num.toFixed(2);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-green-100 text-green-800">Confirmed</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800">Failed</Badge>;
      case 'sent':
        return <Badge className="bg-blue-100 text-blue-800">Sent</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
      </div>
    );
  }

  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Management</h1>
        <p className="text-gray-600">Monitor and manage payment transactions</p>
      </div>

      {/* Failed Payments Alert */}
      {failedPayments.length > 0 && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <CardTitle className="text-red-900">
                {failedPayments.length} Failed Payment{failedPayments.length > 1 ? 's' : ''} Require Attention
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-800 mb-4">
              These payments have failed and may need manual intervention or retry.
            </p>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Retries</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {failedPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-mono text-xs">
                        {payment.subscription?.userWallet?.substring(0, 8)}...
                      </TableCell>
                      <TableCell>
                        {payment.subscription?.plan?.name || 'N/A'}
                      </TableCell>
                      <TableCell className="font-semibold">
                        ${formatAmount(payment.amount)}
                      </TableCell>
                      <TableCell>{getStatusBadge(payment.status)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{payment.retryCount}/5</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-xs text-red-600">
                        {payment.errorMessage || 'Unknown error'}
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatDate(payment.updatedAt)}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRetry(payment.id)}
                          disabled={retrying === payment.id}
                        >
                          {retrying === payment.id ? (
                            <>
                              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                              Retrying...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="h-3 w-3 mr-1" />
                              Retry
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Failed</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {failedPayments.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Needs attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Retry Count</CardTitle>
            <RefreshCw className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {failedPayments.length > 0
                ? (failedPayments.reduce((sum, p) => sum + p.retryCount, 0) / failedPayments.length).toFixed(1)
                : '0'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Out of 5 max
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Amount</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${failedPayments.reduce((sum, p) => sum + parseFloat(formatAmount(p.amount)), 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total value at risk
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Empty State */}
      {failedPayments.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              All Payments Successful
            </h3>
            <p className="text-gray-600 text-center max-w-sm">
              No failed payments at this time. Your subscription payments are processing smoothly.
            </p>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
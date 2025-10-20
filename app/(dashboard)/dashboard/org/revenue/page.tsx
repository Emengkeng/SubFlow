'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  DollarSign, TrendingUp, TrendingDown, 
  Activity, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';

type RevenueStats = {
  totalFees: string;
  totalGasCosts: string;
  netRevenue: string;
  transactionCount: number;
  profitMargin: string;
  avgGasCostPerTx: string;
  isProfitable: boolean;
};

export default function OrgRevenuePage() {
  const [stats, setStats] = useState<RevenueStats | null>(null);
  const [period, setPeriod] = useState('30');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRevenue();
  }, [period]);

  const fetchRevenue = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/platform/revenue?period=${period}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch revenue:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amount: string, decimals = 6) => {
    const num = parseFloat(amount) / Math.pow(10, decimals);
    return num.toFixed(2);
  };

  const formatLamports = (lamports: string) => {
    const sol = parseFloat(lamports) / 1_000_000_000;
    return sol.toFixed(4);
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
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Platform Revenue</h1>
          <p className="text-gray-600">Track platform fees and profitability</p>
        </div>

        <div className="flex gap-2">
          <Button
            variant={period === '7' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriod('7')}
            className={period === '7' ? 'bg-orange-600' : ''}
          >
            7 Days
          </Button>
          <Button
            variant={period === '30' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriod('30')}
            className={period === '30' ? 'bg-orange-600' : ''}
          >
            30 Days
          </Button>
          <Button
            variant={period === '90' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriod('90')}
            className={period === '90' ? 'bg-orange-600' : ''}
          >
            90 Days
          </Button>
        </div>
      </div>

      {stats ? (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Fees Collected</CardTitle>
                <DollarSign className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  ${formatAmount(stats.totalFees)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Platform revenue
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Gas Costs</CardTitle>
                <Zap className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {formatLamports(stats.totalGasCosts)} SOL
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Platform sponsored
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Net Revenue</CardTitle>
                {stats.isProfitable ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${stats.isProfitable ? 'text-green-600' : 'text-red-600'}`}>
                  ${formatAmount(stats.netRevenue)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  After gas costs
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Transactions</CardTitle>
                <Activity className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.transactionCount}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Total payments
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-3 border-b">
                    <span className="text-gray-600">Platform Fees (1 USDC/tx)</span>
                    <span className="text-xl font-bold text-green-600">
                      ${formatAmount(stats.totalFees)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center py-3 border-b">
                    <span className="text-gray-600">Gas Costs Sponsored</span>
                    <span className="text-xl font-bold text-orange-600">
                      -{formatLamports(stats.totalGasCosts)} SOL
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center py-3 bg-gray-50 rounded-lg px-4">
                    <span className="font-semibold text-gray-900">Net Profit</span>
                    <span className={`text-2xl font-bold ${stats.isProfitable ? 'text-green-600' : 'text-red-600'}`}>
                      ${formatAmount(stats.netRevenue)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Efficiency Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-3 border-b">
                    <span className="text-gray-600">Profit Margin</span>
                    <span className={`text-xl font-bold ${stats.isProfitable ? 'text-green-600' : 'text-red-600'}`}>
                      {stats.profitMargin}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center py-3 border-b">
                    <span className="text-gray-600">Avg Gas Cost/Tx</span>
                    <span className="text-xl font-bold">
                      {formatLamports(stats.avgGasCostPerTx)} SOL
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center py-3 border-b">
                    <span className="text-gray-600">Revenue per Transaction</span>
                    <span className="text-xl font-bold text-green-600">
                      $1.00 USDC
                    </span>
                  </div>

                  <div className={`p-4 rounded-lg ${stats.isProfitable ? 'bg-green-50' : 'bg-red-50'}`}>
                    <p className={`text-sm font-medium ${stats.isProfitable ? 'text-green-800' : 'text-red-800'}`}>
                      {stats.isProfitable 
                        ? '✓ Platform is profitable. Gas costs are covered by fees.'
                        : '⚠ Platform is operating at a loss. Consider adjusting fees or optimizing gas usage.'
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Info Card */}
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle className="text-blue-900">Revenue Model</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <h4 className="font-semibold text-blue-900 mb-2">Platform Fee</h4>
                  <p className="text-blue-800">
                    $1 USDC charged per transaction on top of merchant amount
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-blue-900 mb-2">Gas Sponsorship</h4>
                  <p className="text-blue-800">
                    Platform pays all Solana transaction fees including priority fees
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-blue-900 mb-2">Net Revenue</h4>
                  <p className="text-blue-800">
                    Platform fees minus gas costs = {stats.profitMargin} margin
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Activity className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No Revenue Data
            </h3>
            <p className="text-gray-600 text-center max-w-sm">
              Revenue statistics will appear here once transactions are processed.
            </p>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
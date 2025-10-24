'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Calendar, DollarSign, Loader2, AlertCircle, Edit, Eye } from 'lucide-react';

type SubscriptionPlan = {
  id: string;
  name: string;
  description: string | null;
  amountPerBilling: string;
  displayAmount: string;
  billingPeriodDays: number;
  tokenMint: string;
  tokenDecimals: number;
  merchantTokenAccount: string;
  maxPayments: number | null;
  monthlySpendingCap: string | null;
  imageUrl: string | null;
  isActive: boolean;
  createdAt: string;
};

export default function OrgPlansPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    amount: '',
    billingPeriodDays: '30',
    tokenMint: 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr', // USDC
    merchantTokenAccount: '',
    tokenDecimals: '6',
    maxPayments: '',
    imageUrl: '',
  });

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const orgId = localStorage.getItem('currentOrgId');
      
      if (!orgId) {
        throw new Error('No organization selected');
      }

      const response = await fetch(`/api/organizations/${orgId}/plans`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch plans');
      }

      const data = await response.json();
      setPlans(data.plans || []);
    } catch (err: any) {
      console.error('Fetch plans error:', err);
      setError(err.message || 'Failed to load plans');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);

    try {
      const orgId = localStorage.getItem('currentOrgId');
      
      if (!orgId) {
        throw new Error('No organization selected');
      }

      // Convert amount to smallest unit (e.g., $10.00 → 10000000 for USDC)
      const amountInSmallestUnit = Math.floor(
        parseFloat(formData.amount) * Math.pow(10, parseInt(formData.tokenDecimals))
      );

      const response = await fetch(`/api/organizations/${orgId}/plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || undefined,
          tokenMint: formData.tokenMint,
          amountPerBilling: amountInSmallestUnit.toString(),
          billingPeriodDays: parseInt(formData.billingPeriodDays),
          merchantTokenAccount: formData.merchantTokenAccount,
          tokenDecimals: parseInt(formData.tokenDecimals),
          maxPayments: formData.maxPayments ? parseInt(formData.maxPayments) : undefined,
          imageUrl: formData.imageUrl || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create plan');
      }

      await fetchPlans();
      setShowCreateDialog(false);
      resetForm();
      
      alert('✅ Subscription plan created successfully!');
    } catch (err: any) {
      console.error('Create plan error:', err);
      setError(err.message || 'Failed to create plan');
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      amount: '',
      billingPeriodDays: '30',
      tokenMint: 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr',
      merchantTokenAccount: '',
      tokenDecimals: '6',
      maxPayments: '',
      imageUrl: '',
    });
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Subscription Plans</h1>
          <p className="text-gray-600 mt-1">Create and manage recurring payment plans</p>
        </div>
        
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Create Plan
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Subscription Plan</DialogTitle>
              <DialogDescription>
                Set up a new recurring payment plan for your customers
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreatePlan} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="name">Plan Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Pro Monthly Plan"
                    required
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Full access to all features..."
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="amount">Amount (USD) *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="10.00"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="billingPeriod">Billing Period *</Label>
                  <Select
                    value={formData.billingPeriodDays}
                    onValueChange={(value) => setFormData({ ...formData, billingPeriodDays: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">Weekly (7 days)</SelectItem>
                      <SelectItem value="14">Bi-weekly (14 days)</SelectItem>
                      <SelectItem value="30">Monthly (30 days)</SelectItem>
                      <SelectItem value="90">Quarterly (90 days)</SelectItem>
                      <SelectItem value="365">Yearly (365 days)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2">
                  <Label htmlFor="merchantWallet">Your Wallet Address *</Label>
                  <Input
                    id="merchantWallet"
                    value={formData.merchantTokenAccount}
                    onChange={(e) => setFormData({ ...formData, merchantTokenAccount: e.target.value })}
                    placeholder="Your Solana wallet address"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Payments will be sent to this wallet
                  </p>
                </div>

                <div>
                  <Label htmlFor="maxPayments">Max Payments (optional)</Label>
                  <Input
                    id="maxPayments"
                    type="number"
                    min="1"
                    value={formData.maxPayments}
                    onChange={(e) => setFormData({ ...formData, maxPayments: e.target.value })}
                    placeholder="12"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Leave empty for unlimited
                  </p>
                </div>

                <div>
                  <Label htmlFor="tokenMint">Token</Label>
                  <Select
                    value={formData.tokenMint}
                    onValueChange={(value) => setFormData({ ...formData, tokenMint: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr">
                        USDC (recommended)
                      </SelectItem>
                      <SelectItem value="So11111111111111111111111111111111111111112">
                        SOL
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2">
                  <Label htmlFor="imageUrl">Image URL (optional)</Label>
                  <Input
                    id="imageUrl"
                    type="url"
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={creating}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Plan'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && !showCreateDialog && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {plans.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-16 w-16 text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No Subscription Plans Yet
            </h3>
            <p className="text-gray-600 mb-6 text-center max-w-md">
              Create your first subscription plan to start accepting recurring payments from customers
            </p>
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Plan
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <Card key={plan.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  <Badge variant={plan.isActive ? 'default' : 'secondary'}>
                    {plan.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                {plan.description && (
                  <CardDescription className="line-clamp-2">
                    {plan.description}
                  </CardDescription>
                )}
              </CardHeader>

              <CardContent className="flex-1 space-y-4">
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-blue-600">
                      {plan.displayAmount}
                    </span>
                    <span className="text-gray-600">USDC</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Every {plan.billingPeriodDays} days
                  </p>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Billing Cycle:</span>
                    <span className="font-medium">
                      {plan.billingPeriodDays === 7 ? 'Weekly' :
                       plan.billingPeriodDays === 14 ? 'Bi-weekly' :
                       plan.billingPeriodDays === 30 ? 'Monthly' :
                       plan.billingPeriodDays === 90 ? 'Quarterly' :
                       plan.billingPeriodDays === 365 ? 'Yearly' :
                       `${plan.billingPeriodDays} days`}
                    </span>
                  </div>

                  {plan.maxPayments && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Max Payments:</span>
                      <span className="font-medium">{plan.maxPayments}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Created:</span>
                    <span className="font-medium">
                      {new Date(plan.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => window.open(`/subscriptions/${plan.id}`, '_blank')}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `${window.location.origin}/subscriptions/${plan.id}`
                    );
                    alert('✅ Plan link copied to clipboard!');
                  }}
                >
                  Copy Link
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Quick Stats */}
      {plans.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Quick Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Plans</p>
                <p className="text-2xl font-bold text-gray-900">{plans.length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Active Plans</p>
                <p className="text-2xl font-bold text-green-600">
                  {plans.filter(p => p.isActive).length}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Avg. Price</p>
                <p className="text-2xl font-bold text-blue-600">
                  $
                  {(
                    plans.reduce(
                      (sum, p) => sum + parseFloat(p.displayAmount.replace('$', '')),
                      0
                    ) / plans.length
                  ).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Most Popular</p>
                <p className="text-2xl font-bold text-purple-600">
                  {plans[0]?.billingPeriodDays === 30 ? 'Monthly' : 
                   plans[0]?.billingPeriodDays === 7 ? 'Weekly' : 'Other'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
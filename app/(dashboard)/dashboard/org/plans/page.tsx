'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Trash2, DollarSign, Calendar } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';

type Plan = {
  id: string;
  name: string;
  description?: string;
  tokenMint: string;
  amountPerBilling: string;
  billingPeriodDays: number;
  merchantTokenAccount: string;
  tokenDecimals: number;
  isActive: boolean;
  createdAt: string;
};

export default function OrgPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const orgId = localStorage.getItem('currentOrgId');
      const response = await fetch(`/api/organizations/${orgId}/plans`);
      if (response.ok) {
        const data = await response.json();
        setPlans(data.plans || []);
      }
    } catch (error) {
      console.error('Failed to fetch plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlan = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsCreating(true);

    const formData = new FormData(e.currentTarget);
    const orgId = localStorage.getItem('currentOrgId');

    try {
      const response = await fetch(`/api/organizations/${orgId}/plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.get('name'),
          description: formData.get('description'),
          tokenMint: formData.get('tokenMint'),
          amountPerBilling: formData.get('amount'),
          billingPeriodDays: parseInt(formData.get('billingPeriod') as string),
          merchantTokenAccount: formData.get('merchantAccount'),
          tokenDecimals: 6,
        }),
      });

      if (response.ok) {
        await fetchPlans();
        setCreateDialogOpen(false);
        (e.target as HTMLFormElement).reset();
      }
    } catch (error) {
      console.error('Failed to create plan:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditPlan = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedPlan) return;
    
    setIsEditing(true);
    const formData = new FormData(e.currentTarget);
    const orgId = localStorage.getItem('currentOrgId');

    try {
      const response = await fetch(`/api/organizations/${orgId}/plans`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: selectedPlan.id,
          name: formData.get('name'),
          description: formData.get('description'),
          isActive: formData.get('isActive') === 'true',
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        await fetchPlans();
        setEditDialogOpen(false);
        setSelectedPlan(null);
      } else {
        alert(data.error || 'Failed to update plan');
      }
    } catch (error) {
      console.error('Failed to update plan:', error);
      alert('Failed to update plan');
    } finally {
      setIsEditing(false);
    }
  };

  const handleDeletePlan = async () => {
    if (!selectedPlan) return;
    
    setIsDeleting(true);
    const orgId = localStorage.getItem('currentOrgId');

    try {
      const response = await fetch(
        `/api/organizations/${orgId}/plans?planId=${selectedPlan.id}`,
        { method: 'DELETE' }
      );

      const data = await response.json();

      if (response.ok) {
        await fetchPlans();
        setDeleteDialogOpen(false);
        setSelectedPlan(null);
      } else {
        alert(data.error || 'Failed to delete plan');
      }
    } catch (error) {
      console.error('Failed to delete plan:', error);
      alert('Failed to delete plan');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatAmount = (amount: string, decimals = 6) => {
    const num = parseFloat(amount) / Math.pow(10, decimals);
    return num.toFixed(2);
  };

  const getPlatformFee = () => {
    return '1.00';
  };

  const calculateTotalUserPays = (merchantAmount: string) => {
    const merchant = parseFloat(merchantAmount);
    const platformFee = parseFloat(getPlatformFee());
    return (merchant + platformFee).toFixed(2);
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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Subscription Plans</h1>
          <p className="text-gray-600">Create and manage your subscription offerings</p>
        </div>
        
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-orange-600 hover:bg-orange-700">
              <Plus className="h-4 w-4 mr-2" />
              Create Plan
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Subscription Plan</DialogTitle>
              <DialogDescription>
                Set up a new subscription plan for your customers
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreatePlan} className="space-y-4">
              <div>
                <Label htmlFor="name">Plan Name *</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="Premium Monthly"
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Access to all premium features..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="amount">Merchant Amount (USDC) *</Label>
                  <Input
                    id="amount"
                    name="amount"
                    type="number"
                    step="0.01"
                    placeholder="10.00"
                    required
                    onChange={(e) => {
                      const total = calculateTotalUserPays(e.target.value);
                      const preview = document.getElementById('amount-preview');
                      if (preview) {
                        preview.textContent = `User pays: $${total} (includes $${getPlatformFee()} platform fee)`;
                      }
                    }}
                  />
                  <p id="amount-preview" className="text-xs text-gray-500 mt-1">
                    Amount you receive per billing cycle
                  </p>
                </div>

                <div>
                  <Label htmlFor="billingPeriod">Billing Period (Days) *</Label>
                  <Input
                    id="billingPeriod"
                    name="billingPeriod"
                    type="number"
                    placeholder="30"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    How often to charge (e.g., 30 for monthly)
                  </p>
                </div>
              </div>

              <div>
                <Label htmlFor="merchantAccount">Merchant Token Account *</Label>
                <Input
                  id="merchantAccount"
                  name="merchantAccount"
                  placeholder="Your Solana wallet address"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Where you'll receive payments
                </p>
              </div>

              <div>
                <Label htmlFor="tokenMint">Token Mint Address *</Label>
                <Input
                  id="tokenMint"
                  name="tokenMint"
                  defaultValue="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  USDC by default (recommended)
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Platform Fee Model</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Platform charges $1 USDC per transaction</li>
                  <li>• You receive 100% of your specified amount</li>
                  <li>• Platform sponsors all gas costs</li>
                  <li>• Users see total amount upfront</li>
                </ul>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isCreating}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {isCreating ? 'Creating...' : 'Create Plan'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Plan</DialogTitle>
            <DialogDescription>
              Update plan details. Financial settings cannot be changed for plans with active subscriptions.
            </DialogDescription>
          </DialogHeader>
          {selectedPlan && (
            <form onSubmit={handleEditPlan} className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Plan Name *</Label>
                <Input
                  id="edit-name"
                  name="name"
                  defaultValue={selectedPlan.name}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  name="description"
                  defaultValue={selectedPlan.description || ''}
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="edit-isActive">Status</Label>
                <select
                  id="edit-isActive"
                  name="isActive"
                  defaultValue={selectedPlan.isActive ? 'true' : 'false'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditDialogOpen(false);
                    setSelectedPlan(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isEditing}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {isEditing ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Plan</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedPlan?.name}"? This action cannot be undone. 
              Plans with active subscriptions cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedPlan(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePlan}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Deleting...' : 'Delete Plan'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Plans List */}
      {plans.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <DollarSign className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No plans yet</h3>
            <p className="text-gray-600 text-center max-w-sm mb-4">
              Create your first subscription plan to start accepting recurring payments
            </p>
            <Button
              onClick={() => setCreateDialogOpen(true)}
              className="bg-orange-600 hover:bg-orange-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Plan
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <Card key={plan.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-1">{plan.name}</CardTitle>
                    {plan.isActive ? (
                      <Badge className="bg-green-100 text-green-800">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        setSelectedPlan(plan);
                        setEditDialogOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        setSelectedPlan(plan);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {plan.description && (
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {plan.description}
                    </p>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between py-2 border-t">
                      <span className="text-sm text-gray-600">User Pays</span>
                      <span className="text-xl font-bold text-orange-600">
                        ${formatAmount(plan.amountPerBilling, plan.tokenDecimals)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">You Receive</span>
                      <span className="font-semibold">
                        ${(parseFloat(formatAmount(plan.amountPerBilling, plan.tokenDecimals)) - 1).toFixed(2)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Platform Fee</span>
                      <span className="text-gray-500">$1.00</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-600 pt-2 border-t">
                    <Calendar className="h-4 w-4" />
                    <span>Every {plan.billingPeriodDays} days</span>
                  </div>

                  <div className="pt-2">
                    <p className="text-xs text-gray-500 mb-1">Plan ID</p>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                      {plan.id.substring(0, 8)}...
                    </code>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
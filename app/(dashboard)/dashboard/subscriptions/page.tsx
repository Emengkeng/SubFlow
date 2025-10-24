// 'use client';

// import { useState, useEffect } from 'react';
// import { useWallet } from '@solana/wallet-adapter-react';
// import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
// import { Connection, VersionedTransaction } from '@solana/web3.js';
// import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
// import { Button } from '@/components/ui/button';
// import { Badge } from '@/components/ui/badge';
// import { Alert, AlertDescription } from '@/components/ui/alert';
// import { Separator } from '@/components/ui/separator';
// import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
// import {
//   Calendar, DollarSign, Loader2, AlertCircle, CheckCircle,
//   XCircle, Pause, ExternalLink, TrendingUp, Clock
// } from 'lucide-react';
// import {
//   Dialog,
//   DialogContent,
//   DialogDescription,
//   DialogFooter,
//   DialogHeader,
//   DialogTitle,
// } from '@/components/ui/dialog';

// type Subscription = {
//   id: string;
//   status: string;
//   planName: string;
//   planDescription: string | null;
//   merchantName: string;
//   merchantLogo: string | null;
//   amount: string;
//   displayAmount: string;
//   billingPeriodDays: number;
//   nextBillingDate: string;
//   lastBillingDate: string | null;
//   createdAt: string;
//   totalPayments: number;
//   failedPayments: number;
//   totalSpent: string;
// };

// type UpcomingPayment = {
//   subscriptionId: string;
//   organizationName: string;
//   organizationLogo: string | null;
//   planName: string;
//   amount: string;
//   displayAmount: string;
//   dueDate: string;
//   daysUntilDue: number;
// };

// type Stats = {
//   totalSpent: string;
//   totalSpentDisplay: string;
//   totalPayments: number;
//   subscriptionsByStatus: Array<{ status: string; count: number }>;
// };

// const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
//   active: { label: 'Active', color: 'bg-green-100 text-green-800', icon: CheckCircle },
//   pending_approval: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
//   paused: { label: 'Paused', color: 'bg-gray-100 text-gray-800', icon: Pause },
//   cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800', icon: XCircle },
//   expired: { label: 'Expired', color: 'bg-gray-100 text-gray-800', icon: AlertCircle },
// };

// export default function UserSubscriptionsPage() {
//   const { publicKey, connected, sendTransaction } = useWallet();
  
//   const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
//   const [upcomingPayments, setUpcomingPayments] = useState<UpcomingPayment[]>([]);
//   const [stats, setStats] = useState<Stats | null>(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);
  
//   const [cancellingId, setCancellingId] = useState<string | null>(null);
//   const [showCancelDialog, setShowCancelDialog] = useState(false);
//   const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);

//   useEffect(() => {
//     if (connected && publicKey) {
//       fetchSubscriptions();
//     }
//   }, [connected, publicKey]);

//   const fetchSubscriptions = async () => {
//     if (!publicKey) return;

//     try {
//       setLoading(true);
//       setError(null);
      
//       const response = await fetch(`/api/subscriptions/user/${publicKey.toString()}`);
      
//       if (!response.ok) {
//         throw new Error('Failed to fetch subscriptions');
//       }

//       const data = await response.json();
//       setSubscriptions(data.subscriptions || []);
//       setUpcomingPayments(data.upcomingPayments || []);
//       setStats(data.stats || null);
//     } catch (err: any) {
//       console.error('Fetch subscriptions error:', err);
//       setError(err.message || 'Failed to load subscriptions');
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleCancelClick = (subscription: Subscription) => {
//     setSelectedSubscription(subscription);
//     setShowCancelDialog(true);
//   };

//   const handleCancelSubscription = async () => {
//     if (!selectedSubscription || !publicKey || !sendTransaction) return;

//     setCancellingId(selectedSubscription.id);
//     setShowCancelDialog(false);

//     try {
//       console.log('🛑 Cancelling subscription:', selectedSubscription.id);

//       // Step 1: Request cancellation and get revocation transaction
//       const response = await fetch(`/api/subscriptions/${selectedSubscription.id}/cancel`, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           userWallet: publicKey.toString(),
//         }),
//       });

//       if (!response.ok) {
//         const errorData = await response.json();
//         throw new Error(errorData.error || 'Failed to cancel subscription');
//       }

//       const data = await response.json();
//       console.log('✅ Subscription cancelled on backend');

//       // Step 2: Sign revocation transaction (optional but recommended)
//       if (data.revokeTransaction) {
//         console.log('🔐 Revoking delegation...');
        
//         const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com';
//         const connection = new Connection(rpcUrl, 'confirmed');

//         const transactionBuffer = Buffer.from(data.revokeTransaction, 'base64');
//         const transaction = VersionedTransaction.deserialize(transactionBuffer);

//         try {
//           const signature = await sendTransaction(transaction, connection, {
//             skipPreflight: false,
//             preflightCommitment: 'confirmed',
//           });

//           console.log('✅ Delegation revoked:', signature);
//           await connection.confirmTransaction(signature, 'confirmed');
//         } catch (revokeError) {
//           console.warn('⚠️ Revocation failed (subscription still cancelled):', revokeError);
//         }
//       }

//       // Refresh data
//       await fetchSubscriptions();
      
//       alert('✅ Subscription cancelled successfully!');
//     } catch (err: any) {
//       console.error('❌ Cancel failed:', err);
//       alert(`Failed to cancel: ${err.message}`);
//     } finally {
//       setCancellingId(null);
//       setSelectedSubscription(null);
//     }
//   };

//   const formatDate = (dateString: string) => {
//     return new Date(dateString).toLocaleDateString('en-US', {
//       month: 'short',
//       day: 'numeric',
//       year: 'numeric',
//     });
//   };

//   if (!connected) {
//     return (
//       <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
//         <Calendar className="h-16 w-16 text-gray-400 mb-4" />
//         <h2 className="text-2xl font-bold text-gray-900 mb-2">Connect Your Wallet</h2>
//         <p className="text-gray-600 mb-6 text-center">
//           Connect your wallet to view and manage your subscriptions
//         </p>
//         <WalletMultiButton />
//       </div>
//     );
//   }

//   if (loading) {
//     return (
//       <div className="flex items-center justify-center min-h-[60vh]">
//         <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
//       </div>
//     );
//   }

//   return (
//     <div className="max-w-7xl mx-auto px-4 py-8">
//       <div className="mb-8">
//         <h1 className="text-3xl font-bold text-gray-900 mb-2">My Subscriptions</h1>
//         <p className="text-gray-600">Manage your recurring payments</p>
//       </div>

//       {error && (
//         <Alert variant="destructive" className="mb-6">
//           <AlertCircle className="h-4 w-4" />
//           <AlertDescription>{error}</AlertDescription>
//         </Alert>
//       )}

//       {/* Stats Cards */}
//       {stats && (
//         <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
//           <Card>
//             <CardHeader className="pb-3">
//               <CardDescription>Total Spent</CardDescription>
//             </CardHeader>
//             <CardContent>
//               <div className="text-3xl font-bold text-blue-600">
//                 {stats.totalSpentDisplay}
//               </div>
//               <p className="text-sm text-gray-500 mt-1">
//                 Across {stats.totalPayments} payments
//               </p>
//             </CardContent>
//           </Card>

//           <Card>
//             <CardHeader className="pb-3">
//               <CardDescription>Active Subscriptions</CardDescription>
//             </CardHeader>
//             <CardContent>
//               <div className="text-3xl font-bold text-green-600">
//                 {stats.subscriptionsByStatus.find(s => s.status === 'active')?.count || 0}
//               </div>
//               <p className="text-sm text-gray-500 mt-1">
//                 Currently active
//               </p>
//             </CardContent>
//           </Card>

//           <Card>
//             <CardHeader className="pb-3">
//               <CardDescription>Upcoming Payments</CardDescription>
//             </CardHeader>
//             <CardContent>
//               <div className="text-3xl font-bold text-orange-600">
//                 {upcomingPayments.length}
//               </div>
//               <p className="text-sm text-gray-500 mt-1">
//                 Next 30 days
//               </p>
//             </CardContent>
//           </Card>
//         </div>
//       )}

//       {/* Main Content */}
//       <Tabs defaultValue="active" className="space-y-6">
//         <TabsList>
//           <TabsTrigger value="active">Active ({subscriptions.filter(s => s.status === 'active').length})</TabsTrigger>
//           <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
//           <TabsTrigger value="all">All</TabsTrigger>
//         </TabsList>

//         <TabsContent value="active" className="space-y-4">
//           {subscriptions.filter(s => s.status === 'active').length === 0 ? (
//             <Card>
//               <CardContent className="flex flex-col items-center justify-center py-12">
//                 <Calendar className="h-12 w-12 text-gray-400 mb-4" />
//                 <p className="text-gray-600">No active subscriptions</p>
//               </CardContent>
//             </Card>
//           ) : (
//             subscriptions
//               .filter(s => s.status === 'active')
//               .map((sub) => (
//                 <SubscriptionCard
//                   key={sub.id}
//                   subscription={sub}
//                   onCancel={handleCancelClick}
//                   cancelling={cancellingId === sub.id}
//                 />
//               ))
//           )}
//         </TabsContent>

//         <TabsContent value="upcoming" className="space-y-4">
//           {upcomingPayments.length === 0 ? (
//             <Card>
//               <CardContent className="flex flex-col items-center justify-center py-12">
//                 <Clock className="h-12 w-12 text-gray-400 mb-4" />
//                 <p className="text-gray-600">No upcoming payments</p>
//               </CardContent>
//             </Card>
//           ) : (
//             upcomingPayments.map((payment) => (
//               <Card key={payment.subscriptionId}>
//                 <CardContent className="flex items-center justify-between p-6">
//                   <div className="flex items-center gap-4">
//                     {payment.organizationLogo ? (
//                       <img
//                         src={payment.organizationLogo}
//                         alt={payment.organizationName}
//                         className="h-12 w-12 rounded-full"
//                       />
//                     ) : (
//                       <div className="h-12 w-12 bg-gray-200 rounded-full flex items-center justify-center">
//                         <Calendar className="h-6 w-6 text-gray-400" />
//                       </div>
//                     )}
//                     <div>
//                       <h3 className="font-semibold text-gray-900">{payment.planName}</h3>
//                       <p className="text-sm text-gray-600">{payment.organizationName}</p>
//                     </div>
//                   </div>

//                   <div className="text-right">
//                     <p className="font-bold text-gray-900">{payment.displayAmount}</p>
//                     <p className="text-sm text-gray-600">
//                       {payment.daysUntilDue === 0
//                         ? 'Due today'
//                         : `Due in ${payment.daysUntilDue} days`}
//                     </p>
//                     <p className="text-xs text-gray-500">{formatDate(payment.dueDate)}</p>
//                   </div>
//                 </CardContent>
//               </Card>
//             ))
//           )}
//         </TabsContent>

//         <TabsContent value="all" className="space-y-4">
//           {subscriptions.length === 0 ? (
//             <Card>
//               <CardContent className="flex flex-col items-center justify-center py-12">
//                 <Calendar className="h-12 w-12 text-gray-400 mb-4" />
//                 <p className="text-gray-600 mb-4">No subscriptions yet</p>
//                 <Button onClick={() => window.location.href = '/subscriptions'}>
//                   Browse Plans
//                 </Button>
//               </CardContent>
//             </Card>
//           ) : (
//             subscriptions.map((sub) => (
//               <SubscriptionCard
//                 key={sub.id}
//                 subscription={sub}
//                 onCancel={handleCancelClick}
//                 cancelling={cancellingId === sub.id}
//               />
//             ))
//           )}
//         </TabsContent>
//       </Tabs>

//       {/* Cancel Dialog */}
//       <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
//         <DialogContent>
//           <DialogHeader>
//             <DialogTitle>Cancel Subscription?</DialogTitle>
//             <DialogDescription>
//               Are you sure you want to cancel your subscription to{' '}
//               <span className="font-semibold">{selectedSubscription?.planName}</span>?
//             </DialogDescription>
//           </DialogHeader>

//           <div className="space-y-2 py-4">
//             <p className="text-sm text-gray-600">
//               • No further payments will be charged
//             </p>
//             <p className="text-sm text-gray-600">
//               • You'll be asked to revoke the payment delegation
//             </p>
//             <p className="text-sm text-gray-600">
//               • This action cannot be undone
//             </p>
//           </div>

//           <DialogFooter>
//             <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
//               Keep Subscription
//             </Button>
//             <Button
//               variant="destructive"
//               onClick={handleCancelSubscription}
//             >
//               Cancel Subscription
//             </Button>
//           </DialogFooter>
//         </DialogContent>
//       </Dialog>
//     </div>
//   );
// }

// function SubscriptionCard({
//   subscription,
//   onCancel,
//   cancelling,
// }: {
//   subscription: Subscription;
//   onCancel: (sub: Subscription) => void;
//   cancelling: boolean;
// }) {
//   const config = statusConfig[subscription.status] || statusConfig.active;
//   const StatusIcon = config.icon;

//   return (
//     <Card>
//       <CardHeader>
//         <div className="flex items-start justify-between">
//           <div className="flex items-center gap-4">
//             {subscription.merchantLogo ? (
//               <img
//                 src={subscription.merchantLogo}
//                 alt={subscription.merchantName}
//                 className="h-12 w-12 rounded-full"
//               />
//             ) : (
//               <div className="h-12 w-12 bg-gray-200 rounded-full flex items-center justify-center">
//                 <TrendingUp className="h-6 w-6 text-gray-400" />
//               </div>
//             )}
//             <div>
//               <CardTitle className="text-xl">{subscription.planName}</CardTitle>
//               <CardDescription>{subscription.merchantName}</CardDescription>
//             </div>
//           </div>

//           <Badge className={config.color}>
//             <StatusIcon className="h-3 w-3 mr-1" />
//             {config.label}
//           </Badge>
//         </div>
//       </CardHeader>

//       <CardContent className="space-y-4">
//         {subscription.planDescription && (
//           <>
//             <p className="text-sm text-gray-600">{subscription.planDescription}</p>
//             <Separator />
//           </>
//         )}

//         <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
//           <div>
//             <p className="text-sm text-gray-600 mb-1">Amount</p>
//             <p className="font-semibold text-gray-900">{subscription.displayAmount}</p>
//           </div>

//           <div>
//             <p className="text-sm text-gray-600 mb-1">Billing Period</p>
//             <p className="font-semibold text-gray-900">
//               Every {subscription.billingPeriodDays} days
//             </p>
//           </div>

//           <div>
//             <p className="text-sm text-gray-600 mb-1">
//               {subscription.status === 'active' ? 'Next Payment' : 'Last Payment'}
//             </p>
//             <p className="font-semibold text-gray-900">
//               {subscription.status === 'active'
//                 ? formatDate(subscription.nextBillingDate)
//                 : subscription.lastBillingDate
//                 ? formatDate(subscription.lastBillingDate)
//                 : 'N/A'}
//             </p>
//           </div>

//           <div>
//             <p className="text-sm text-gray-600 mb-1">Total Paid</p>
//             <p className="font-semibold text-gray-900">
//               ${(parseFloat(subscription.totalSpent) / 1_000_000).toFixed(2)}
//             </p>
//             <p className="text-xs text-gray-500">
//               {subscription.totalPayments} payments
//             </p>
//           </div>
//         </div>

//         {subscription.failedPayments > 0 && (
//           <Alert variant="destructive">
//             <AlertCircle className="h-4 w-4" />
//             <AlertDescription>
//               {subscription.failedPayments} failed payment(s). Please ensure sufficient balance.
//             </AlertDescription>
//           </Alert>
//         )}
//       </CardContent>

//       <CardFooter className="flex gap-2">
//         {subscription.status === 'active' && (
//           <Button
//             variant="destructive"
//             onClick={() => onCancel(subscription)}
//             disabled={cancelling}
//           >
//             {cancelling ? (
//               <>
//                 <Loader2 className="h-4 w-4 mr-2 animate-spin" />
//                 Cancelling...
//               </>
//             ) : (
//               'Cancel Subscription'
//             )}
//           </Button>
//         )}
        
//         <Button
//           variant="outline"
//           onClick={() => window.open(`/subscriptions/${subscription.id}/details`, '_blank')}
//         >
//           View Details
//           <ExternalLink className="h-4 w-4 ml-2" />
//         </Button>
//       </CardFooter>
//     </Card>
//   );
// }

// function formatDate(dateString: string) {
//   return new Date(dateString).toLocaleDateString('en-US', {
//     month: 'short',
//     day: 'numeric',
//     year: 'numeric',
//   });
// }
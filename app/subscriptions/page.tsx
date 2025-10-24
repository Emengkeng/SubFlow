// 'use client';

// import { useState, useEffect } from 'react';
// import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
// import { Button } from '@/components/ui/button';
// import { Input } from '@/components/ui/input';
// import { Badge } from '@/components/ui/badge';
// import { Search, Loader2, Calendar, DollarSign, Building2 } from 'lucide-react';
// import { useRouter } from 'next/navigation';
// import Image from 'next/image';

// type SubscriptionPlan = {
//   id: string;
//   name: string;
//   description: string | null;
//   amountPerBilling: string;
//   displayAmount: string;
//   billingPeriodDays: number;
//   billingDescription: string;
//   imageUrl: string | null;
//   tokenMint: string;
//   tokenDecimals: number;
//   maxPayments: number | null;
//   isActive: boolean;
//   organization: {
//     id: string;
//     name: string;
//     logoUrl: string | null;
//   };
// };

// export default function SubscriptionPlansPage() {
//   const router = useRouter();
//   const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [searchQuery, setSearchQuery] = useState('');
//   const [error, setError] = useState<string | null>(null);

//   useEffect(() => {
//     fetchPlans();
//   }, []);

//   const fetchPlans = async () => {
//     try {
//       setLoading(true);
//       const response = await fetch('/api/plans/search');
      
//       if (!response.ok) {
//         throw new Error('Failed to fetch subscription plans');
//       }

//       const data = await response.json();
//       setPlans(data.plans || []);
//     } catch (err: any) {
//       console.error('Fetch plans error:', err);
//       setError(err.message || 'Failed to load plans');
//     } finally {
//       setLoading(false);
//     }
//   };

//   const filteredPlans = plans.filter((plan) => {
//     const query = searchQuery.toLowerCase();
//     return (
//       plan.name.toLowerCase().includes(query) ||
//       plan.description?.toLowerCase().includes(query) ||
//       plan.organization.name.toLowerCase().includes(query)
//     );
//   });

//   const handlePlanClick = (planId: string) => {
//     router.push(`/subscriptions/${planId}`);
//   };

//   if (loading) {
//     return (
//       <div className="flex items-center justify-center min-h-screen">
//         <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen bg-gray-50">
//       {/* Hero Section */}
//       <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
//         <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
//           <div className="text-center">
//             <h1 className="text-4xl font-bold mb-4">Subscription Plans</h1>
//             <p className="text-xl text-blue-100 mb-8">
//               Subscribe to services and pay automatically with crypto
//             </p>
            
//             {/* Search Bar */}
//             <div className="max-w-2xl mx-auto">
//               <div className="relative">
//                 <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
//                 <Input
//                   type="text"
//                   placeholder="Search subscription plans..."
//                   value={searchQuery}
//                   onChange={(e) => setSearchQuery(e.target.value)}
//                   className="pl-12 py-6 text-lg bg-white text-gray-900"
//                 />
//               </div>
//             </div>
//           </div>
//         </div>
//       </div>

//       {/* Plans Grid */}
//       <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
//         {error && (
//           <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
//             {error}
//           </div>
//         )}

//         <div className="flex items-center justify-between mb-6">
//           <h2 className="text-2xl font-bold text-gray-900">
//             {filteredPlans.length} Plans Available
//           </h2>
//         </div>

//         {filteredPlans.length === 0 ? (
//           <div className="text-center py-12">
//             <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
//             <h3 className="text-xl font-semibold text-gray-900 mb-2">
//               {searchQuery ? 'No plans found' : 'No subscription plans available'}
//             </h3>
//             <p className="text-gray-600">
//               {searchQuery
//                 ? 'Try adjusting your search terms'
//                 : 'Check back later for new plans'}
//             </p>
//           </div>
//         ) : (
//           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
//             {filteredPlans.map((plan) => (
//               <Card
//                 key={plan.id}
//                 className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-blue-200"
//                 onClick={() => handlePlanClick(plan.id)}
//               >
//                 <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100">
//                   <div className="flex items-center justify-between mb-2">
//                     <Badge className="bg-blue-600">
//                       {plan.billingDescription}
//                     </Badge>
//                     {!plan.isActive && (
//                       <Badge variant="secondary">Unavailable</Badge>
//                     )}
//                   </div>
                  
//                   <CardTitle className="text-2xl mb-2">{plan.name}</CardTitle>
                  
//                   <div className="flex items-baseline gap-2">
//                     <span className="text-3xl font-bold text-blue-600">
//                       {plan.displayAmount}
//                     </span>
//                     <span className="text-gray-600">USDC</span>
//                     <span className="text-sm text-gray-500">
//                       / {plan.billingPeriodDays} days
//                     </span>
//                   </div>
//                 </CardHeader>

//                 <CardContent className="pt-6">
//                   {plan.organization && (
//                     <div className="flex items-center gap-2 mb-4">
//                       {plan.organization.logoUrl ? (
//                         <Image
//                           src={plan.organization.logoUrl}
//                           alt={plan.organization.name}
//                           width={24}
//                           height={24}
//                           className="rounded-full"
//                         />
//                       ) : (
//                         <Building2 className="h-5 w-5 text-gray-400" />
//                       )}
//                       <span className="text-sm font-medium text-gray-700">
//                         {plan.organization.name}
//                       </span>
//                     </div>
//                   )}

//                   {plan.description && (
//                     <p className="text-sm text-gray-600 line-clamp-3 mb-4">
//                       {plan.description}
//                     </p>
//                   )}

//                   <div className="space-y-2 text-sm text-gray-600">
//                     {plan.maxPayments && (
//                       <div className="flex items-center gap-2">
//                         <Calendar className="h-4 w-4" />
//                         <span>Up to {plan.maxPayments} payments</span>
//                       </div>
//                     )}
//                     <div className="flex items-center gap-2">
//                       <DollarSign className="h-4 w-4" />
//                       <span>Automatic recurring payments</span>
//                     </div>
//                   </div>
//                 </CardContent>

//                 <CardFooter>
//                   <Button
//                     className="w-full bg-blue-600 hover:bg-blue-700"
//                     disabled={!plan.isActive}
//                     onClick={(e) => {
//                       e.stopPropagation();
//                       handlePlanClick(plan.id);
//                     }}
//                   >
//                     {plan.isActive ? 'Subscribe Now' : 'Unavailable'}
//                   </Button>
//                 </CardFooter>
//               </Card>
//             ))}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }
import { desc, and, eq, lte, sql, inArray, gte, asc, isNull } from 'drizzle-orm';
import { db } from './drizzle';
import {
  organizations,
  products,
  paymentSessions,
  payments,
  webhooks,
  deadLetterQueue,
  platformConfig,
  platformRevenue,
  // NEW: Subscription tables
  subscriptionPlans,
  subscriptions,
  subscriptionPayments,
  type Organization,
  type Product,
  type PaymentSession,
  type Payment,
  type Subscription,
  type SubscriptionPlan,
  purchases,
  downloadLinks,
  categories,
} from './schema';

// ============================================================================
// EXISTING PRODUCT QUERIES (keep all your existing ones)
// ============================================================================

export async function getOrganizationByApiKey(apiKey: string) {
  const result = await db
    .select()
    .from(organizations)
    .where(and(eq(organizations.apiKey, apiKey), eq(organizations.isActive, true)))
    .limit(1);

  return result[0] || null;
}

export async function createOrganization(data: {
  name: string;
  email: string;
  apiKey: string;
  webhookUrl?: string;
  webhookSecret?: string;
  website?: string;
  logoUrl?: string;
}) {
  const result = await db
    .insert(organizations)
    .values(data)
    .returning();

  return result[0];
}

export async function getOrganizationById(orgId: string) {
  const result = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  return result[0] || null;
}

export async function createProduct(data: {
  organizationId: string;
  name: string;
  slug: string;
  description?: string;
  price: string;
  tokenMint: string;
  tokenDecimals?: number;
  merchantWallet: string;
  imageUrl?: string;
  previewUrl?: string;
  thumbnailUrl?: string;
  metadata?: any;
  productType?: string;
  fileSize?: number;
  fileType?: string;
  downloadLimit?: number;
  linkExpiryHours?: number;
  supabaseFileId?: string;
  supabaseBucket?: string;
  categoryId?: string;
  tags?: string[];
  searchVector?: string;
  viewCount?: number;
  purchaseCount?: number;
  rating?: string;
  reviewCount?: number;
  isActive?: boolean;
  isFeatured?: boolean;
  publishedAt?: Date;
}) {
  const result = await db
    .insert(products)
    .values({
      ...data,
      tokenDecimals: data.tokenDecimals || 6,
      productType: data.productType || 'digital',
      downloadLimit: data.downloadLimit || 5,
      linkExpiryHours: data.linkExpiryHours || 24,
      supabaseBucket: data.supabaseBucket || 'digital-products',
      isActive: data.isActive ?? true,
      isFeatured: data.isFeatured ?? false,
      viewCount: data.viewCount || 0,
      purchaseCount: data.purchaseCount || 0,
      rating: data.rating || '0',
      reviewCount: data.reviewCount || 0,
      // Auto-set publishedAt if active
      publishedAt: data.isActive !== false ? new Date() : data.publishedAt,
    })
    .returning();

  return result[0];
}

export async function getProductById(productId: string) {
  const result = await db.query.products.findFirst({
    where: and(eq(products.id, productId), eq(products.isActive, true)),
    with: {
      organization: true,
    },
  });

  return result || null;
}

export async function getProductsByOrganization(organizationId: string) {
  return await db
    .select()
    .from(products)
    .where(eq(products.organizationId, organizationId))
    .orderBy(desc(products.createdAt));
}

export async function updateProduct(productId: string, data: Partial<Product>) {
  const result = await db
    .update(products)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(products.id, productId))
    .returning();

  return result[0];
}

export async function deleteProduct(productId: string) {
  const result = await db
    .update(products)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(products.id, productId))
    .returning();

  return result[0];
}

export async function searchProducts(query: {
  search?: string;
  organizationId?: string;
  minPrice?: string;
  maxPrice?: string;
  isActive?: boolean;
}) {
  let conditions = [];

  if (query.organizationId) {
    conditions.push(eq(products.organizationId, query.organizationId));
  }

  if (query.isActive !== undefined) {
    conditions.push(eq(products.isActive, query.isActive));
  }

  if (query.minPrice) {
    conditions.push(sql`${products.price} >= ${query.minPrice}`);
  }

  if (query.maxPrice) {
    conditions.push(sql`${products.price} <= ${query.maxPrice}`);
  }

  if (query.search) {
    conditions.push(
      sql`(${products.name} ILIKE ${'%' + query.search + '%'} OR ${products.description} ILIKE ${'%' + query.search + '%'})`
    );
  }

  return await db.query.products.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    with: {
      organization: {
        columns: {
          id: true,
          name: true,
          logoUrl: true,
        },
      },
    },
    orderBy: [desc(products.createdAt)],
    limit: 50,
  });
}

export async function createPaymentSession(data: {
  productId: string;
  organizationId: string;
  customerWallet?: string;
  customerEmail?: string;
  amount: string;
  platformFee: string;
  totalAmount: string;
  tokenMint: string;
  tokenDecimals: number;
  merchantWallet: string;
  expiresAt: Date;
  metadata?: any;
  successUrl?: string;
  cancelUrl?: string;
}) {
  const result = await db
    .insert(paymentSessions)
    .values(data)
    .returning();

  return result[0];
}

export async function getPaymentSessionById(sessionId: string) {
  const result = await db.query.paymentSessions.findFirst({
    where: eq(paymentSessions.id, sessionId),
    with: {
      product: {
        with: {
          organization: true,
        },
      },
      payments: {
        orderBy: [desc(payments.createdAt)],
        limit: 1,
      },
    },
  });

  return result || null;
}

export async function updatePaymentSession(
  sessionId: string,
  data: Partial<PaymentSession>
) {
  const result = await db
    .update(paymentSessions)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(paymentSessions.id, sessionId))
    .returning();

  return result[0];
}

export async function createPayment(data: {
  sessionId: string;
  productId: string;
  organizationId: string;
  merchantAmount: string;
  platformFee: string;
  totalAmount: string;
  gasCost: string;
  txSignature: string;
  deliveryMethod?: string;
  priorityFee?: string;
  slotSent?: number;
}) {
  const result = await db
    .insert(payments)
    .values(data)
    .returning();

  return result[0];
}

export async function updatePayment(paymentId: string, data: Partial<Payment>) {
  const result = await db
    .update(payments)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(payments.id, paymentId))
    .returning();

  return result[0];
}

export async function getPlatformConfig() {
  const result = await db
    .select()
    .from(platformConfig)
    .limit(1);

  return result[0] || null;
}

export async function createPlatformRevenue(data: {
  paymentId: string;
  organizationId: string;
  feeAmount: string;
  merchantAmount: string;
  totalAmount: string;
  gasCost: string;
  txSignature: string;
}) {
  const netRevenue = BigInt(data.feeAmount) - BigInt(data.gasCost);

  const result = await db
    .insert(platformRevenue)
    .values({
      ...data,
      netRevenue: netRevenue.toString(),
    })
    .returning();

  return result[0];
}

export async function addToDeadLetterQueue(data: {
  paymentId?: string;
  sessionId?: string;
  errorType: string;
  errorMessage: string;
  metadata: any;
}) {
  await db.insert(deadLetterQueue).values(data);
}

// ============================================================================
// NEW: SUBSCRIPTION PLAN QUERIES
// ============================================================================

export async function createSubscriptionPlan(data: {
  organizationId: string;
  name: string;
  description?: string;
  tokenMint: string;
  amountPerBilling: string;
  billingPeriodDays: number;
  merchantTokenAccount: string;
  tokenDecimals?: number;
  maxPayments?: number;
  monthlySpendingCap?: string;
  imageUrl?: string;
  metadata?: any;
}) {
  const result = await db
    .insert(subscriptionPlans)
    .values({
      ...data,
      tokenDecimals: data.tokenDecimals || 6,
    })
    .returning();

  return result[0];
}

export async function getSubscriptionPlanById(planId: string) {
  const result = await db.query.subscriptionPlans.findFirst({
    where: and(
      eq(subscriptionPlans.id, planId),
      eq(subscriptionPlans.isActive, true)
    ),
    with: {
      organization: true,
    },
  });

  return result || null;
}

export async function getPlansByOrganization(organizationId: string) {
  return await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.organizationId, organizationId))
    .orderBy(desc(subscriptionPlans.createdAt));
}

export async function searchSubscriptionPlans(query: {
  search?: string;
  organizationId?: string;
  minAmount?: string;
  maxAmount?: string;
  billingPeriod?: number;
}) {
  const conditions = [];

  if (query.organizationId) {
    conditions.push(eq(subscriptionPlans.organizationId, query.organizationId));
  }

  conditions.push(eq(subscriptionPlans.isActive, true));

  if (query.minAmount) {
    conditions.push(sql`${subscriptionPlans.amountPerBilling} >= ${query.minAmount}`);
  }

  if (query.maxAmount) {
    conditions.push(sql`${subscriptionPlans.amountPerBilling} <= ${query.maxAmount}`);
  }

  if (query.billingPeriod) {
    conditions.push(eq(subscriptionPlans.billingPeriodDays, query.billingPeriod));
  }

  if (query.search) {
    conditions.push(
      sql`(${subscriptionPlans.name} ILIKE ${'%' + query.search + '%'} OR ${subscriptionPlans.description} ILIKE ${'%' + query.search + '%'})`
    );
  }

  return await db.query.subscriptionPlans.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    with: {
      organization: {
        columns: {
          id: true,
          name: true,
          logoUrl: true,
        },
      },
    },
    orderBy: [desc(subscriptionPlans.createdAt)],
    limit: 50,
  });
}

// ============================================================================
// NEW: SUBSCRIPTION QUERIES
// ============================================================================

export async function createSubscription(data: {
  planId: string;
  organizationId: string;
  userWallet: string;
  userEmail?: string;
  userTokenAccount: string;
  delegateAuthority: string;
  amount: string;
  platformFee: string;
  totalAmount: string;
  nextBillingDate: Date;
  metadata?: any;
}) {
  const result = await db
    .insert(subscriptions)
    .values(data)
    .returning();

  return result[0];
}

export async function getSubscriptionById(subscriptionId: string) {
  const result = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.id, subscriptionId),
    with: {
      plan: {
        with: {
          organization: true,
        },
      },
      payments: {
        orderBy: [desc(subscriptionPayments.createdAt)],
        limit: 10,
      },
    },
  });

  return result || null;
}

export async function getUserSubscriptions(walletAddress: string) {
  return await db.query.subscriptions.findMany({
    where: eq(subscriptions.userWallet, walletAddress),
    with: {
      plan: {
        with: {
          organization: true,
        },
      },
      payments: {
        where: eq(subscriptionPayments.status, 'confirmed'),
        orderBy: [desc(subscriptionPayments.createdAt)],
      },
    },
    orderBy: [desc(subscriptions.createdAt)],
  });
}

export async function updateSubscription(
  subscriptionId: string,
  data: Partial<Subscription>
) {
  const result = await db
    .update(subscriptions)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(subscriptions.id, subscriptionId))
    .returning();

  return result[0];
}

export async function getDueSubscriptions(limit = 100) {
  const now = new Date();
  
  return await db.query.subscriptions.findMany({
    where: and(
      eq(subscriptions.status, 'active'),
      lte(subscriptions.nextBillingDate, now),
      eq(subscriptions.delegationVerified, true)
    ),
    with: {
      plan: {
        with: {
          organization: true,
        },
      },
    },
    limit,
    orderBy: [subscriptions.nextBillingDate],
  });
}

export async function getDueSubscriptionsGroupedByOrg(limit = 1000) {
  const subs = await getDueSubscriptions(limit);
  
  // Group by organization for efficient processing
  const grouped: Record<string, typeof subs> = {};
  
  for (const sub of subs) {
    const orgId = sub.organizationId;
    if (!grouped[orgId]) {
      grouped[orgId] = [];
    }
    grouped[orgId].push(sub);
  }
  
  return grouped;
}

export async function hasActiveSubscription(planId: string, userWallet: string) {
  const result = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.planId, planId),
        eq(subscriptions.userWallet, userWallet),
        sql`${subscriptions.status} IN ('active', 'pending_approval')`
      )
    )
    .limit(1);

  return result.length > 0;
}

// ============================================================================
// NEW: SUBSCRIPTION PAYMENT QUERIES
// ============================================================================

export async function createSubscriptionPayment(data: {
  subscriptionId: string;
  amount: string;
  platformFee: string;
  totalAmount: string;
}) {
  const result = await db
    .insert(subscriptionPayments)
    .values(data)
    .returning();

  return result[0];
}

export async function updateSubscriptionPayment(
  paymentId: string,
  data: Partial<typeof subscriptionPayments.$inferInsert>
) {
  const result = await db
    .update(subscriptionPayments)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(subscriptionPayments.id, paymentId))
    .returning();

  return result[0];
}

export async function getSubscriptionPayments(subscriptionId: string, limit = 50) {
  return await db
    .select()
    .from(subscriptionPayments)
    .where(eq(subscriptionPayments.subscriptionId, subscriptionId))
    .orderBy(desc(subscriptionPayments.createdAt))
    .limit(limit);
}

// ============================================================================
// NEW: SUBSCRIPTION ANALYTICS
// ============================================================================

export async function getSubscriptionStats(userWallet: string) {
  const [statusCounts, totalSpent] = await Promise.all([
    db
      .select({
        status: subscriptions.status,
        count: sql<number>`count(*)::int`,
      })
      .from(subscriptions)
      .where(eq(subscriptions.userWallet, userWallet))
      .groupBy(subscriptions.status),
    
    db
      .select({
        total: sql<string>`COALESCE(SUM(${subscriptionPayments.totalAmount}), 0)`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(subscriptionPayments)
      .innerJoin(subscriptions, eq(subscriptionPayments.subscriptionId, subscriptions.id))
      .where(
        and(
          eq(subscriptions.userWallet, userWallet),
          eq(subscriptionPayments.status, 'confirmed')
        )
      ),
  ]);

  return {
    subscriptionsByStatus: statusCounts,
    totalSpent: totalSpent[0]?.total || '0',
    totalPayments: totalSpent[0]?.count || 0,
  };
}

export async function getUpcomingPayments(userWallet: string, days = 30) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);

  return await db.query.subscriptions.findMany({
    where: and(
      eq(subscriptions.userWallet, userWallet),
      eq(subscriptions.status, 'active'),
      lte(subscriptions.nextBillingDate, futureDate)
    ),
    with: {
      plan: {
        with: {
          organization: true,
        },
      },
    },
    orderBy: [subscriptions.nextBillingDate],
  });
}

// ============================================================================
// WEBHOOK QUERIES (for both products AND subscriptions)
// ============================================================================

export async function createWebhook(data: {
  organizationId: string;
  eventType: string;
  payload: any;
}) {
  const result = await db
    .insert(webhooks)
    .values(data)
    .returning();

  return result[0];
}

export async function getPendingWebhooks(limit = 50) {
  return await db.query.webhooks.findMany({
    where: eq(webhooks.status, 'pending'),
    with: {
      organization: true,
    },
    limit,
    orderBy: [webhooks.createdAt],
  });
}

export async function updateWebhook(
  webhookId: string,
  data: Partial<typeof webhooks.$inferInsert>
) {
  const result = await db
    .update(webhooks)
    .set(data)
    .where(eq(webhooks.id, webhookId))
    .returning();

  return result[0];
}

export async function updateOrganization(
  orgId: string,
  data: Partial<Organization>
) {
  const result = await db
    .update(organizations)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(organizations.id, orgId))
    .returning();

  return result[0];
}

export async function getSessionsByCustomerWallet(walletAddress: string, limit = 50) {
  return await db.query.paymentSessions.findMany({
    where: eq(paymentSessions.customerWallet, walletAddress),
    with: {
      product: {
        with: {
          organization: true,
        },
      },
      payments: {
        where: eq(payments.status, 'confirmed'),
        orderBy: [desc(payments.createdAt)],
      },
    },
    orderBy: [desc(paymentSessions.createdAt)],
    limit,
  });
}

export async function expireOldSessions() {
  const result = await db
    .update(paymentSessions)
    .set({ status: 'expired', updatedAt: new Date() })
    .where(
      and(
        eq(paymentSessions.status, 'pending'),
        lte(paymentSessions.expiresAt, new Date())
      )
    )
    .returning();

  return result.length;
}

export async function getSessionsByProduct(productId: string, limit = 50) {
  return await db.query.paymentSessions.findMany({
    where: eq(paymentSessions.productId, productId),
    with: {
      payments: true,
    },
    orderBy: [desc(paymentSessions.createdAt)],
    limit,
  });
}

export async function getPaymentById(paymentId: string) {
  const result = await db.query.payments.findFirst({
    where: eq(payments.id, paymentId),
    with: {
      session: {
        with: {
          product: {
            with: {
              organization: true,
            },
          },
        },
      },
    },
  });

  return result || null;
}

export async function getPaymentByTxSignature(txSignature: string) {
  const result = await db.query.payments.findFirst({
    where: eq(payments.txSignature, txSignature),
    with: {
      session: {
        with: {
          product: {
            with: {
              organization: true,
            },
          },
        },
      },
    },
  });

  return result || null;
}

export async function getPaymentsByOrganization(organizationId: string, limit = 50) {
  return await db.query.payments.findMany({
    where: eq(payments.organizationId, organizationId),
    with: {
      product: true,
      session: true,
    },
    orderBy: [desc(payments.createdAt)],
    limit,
  });
}

export async function getPaymentsByProduct(productId: string, limit = 50) {
  return await db.query.payments.findMany({
    where: eq(payments.productId, productId),
    with: {
      session: true,
    },
    orderBy: [desc(payments.createdAt)],
    limit,
  });
}

export async function getFailedPayments(limit = 100) {
  return await db.query.payments.findMany({
    where: eq(payments.status, 'failed'),
    with: {
      session: {
        with: {
          product: {
            with: {
              organization: true,
            },
          },
        },
      },
    },
    limit,
    orderBy: [desc(payments.updatedAt)],
  });
}

// ============================================================================
// ANALYTICS QUERIES
// ============================================================================

export async function getOrganizationRevenue(organizationId: string) {
  const result = await db
    .select({
      totalRevenue: sql<string>`COALESCE(sum(${payments.merchantAmount}), 0)`,
      confirmedPayments: sql<number>`count(*)::int`,
      totalVolume: sql<string>`COALESCE(sum(${payments.totalAmount}), 0)`,
    })
    .from(payments)
    .where(
      and(
        eq(payments.organizationId, organizationId),
        eq(payments.status, 'confirmed')
      )
    );

  return result[0];
}

export async function getPaymentMetrics(organizationId?: string) {
  let conditions = organizationId ? [eq(payments.organizationId, organizationId)] : [];

  const [statusCounts, recent24h] = await Promise.all([
    db
      .select({
        status: payments.status,
        count: sql<number>`count(*)::int`,
        totalAmount: sql<string>`COALESCE(sum(${payments.totalAmount}), 0)`,
      })
      .from(payments)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(payments.status),
    
    db
      .select({
        status: payments.status,
        count: sql<number>`count(*)::int`,
        totalAmount: sql<string>`COALESCE(sum(${payments.totalAmount}), 0)`,
      })
      .from(payments)
      .where(
        conditions.length > 0 
          ? and(...conditions, sql`${payments.createdAt} > NOW() - INTERVAL '24 hours'`)
          : sql`${payments.createdAt} > NOW() - INTERVAL '24 hours'`
      )
      .groupBy(payments.status),
  ]);

  return {
    allTime: statusCounts,
    last24h: recent24h,
  };
}

export async function getProductMetrics(organizationId: string) {
  const result = await db
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) FILTER (WHERE ${products.isActive} = true)::int`,
    })
    .from(products)
    .where(eq(products.organizationId, organizationId));

  return result[0];
}

export async function getOrganizationMetrics(organizationId: string) {
  const [productMetrics, paymentMetrics] = await Promise.all([
    getProductMetrics(organizationId),
    getPaymentMetrics(organizationId),
  ]);

  return {
    products: productMetrics,
    payments: paymentMetrics,
  };
}

// ============================================================================
// PLATFORM REVENUE
// ============================================================================
export async function updatePlatformConfig(data: Partial<typeof platformConfig.$inferInsert>) {
  const result = await db
    .update(platformConfig)
    .set({ ...data, updatedAt: new Date() })
    .returning();

  return result[0];
}

export async function getPlatformRevenueStats(startDate?: Date, endDate?: Date) {
  const conditions = [];
  
  if (startDate && endDate) {
    conditions.push(
      and(
        sql`${platformRevenue.createdAt} >= ${startDate}`,
        sql`${platformRevenue.createdAt} <= ${endDate}`
      )
    );
  }

  const result = await db
    .select({
      totalFees: sql<string>`COALESCE(SUM(${platformRevenue.feeAmount}), 0)`,
      totalGasCosts: sql<string>`COALESCE(SUM(${platformRevenue.gasCost}), 0)`,
      totalNetRevenue: sql<string>`COALESCE(SUM(${platformRevenue.netRevenue}), 0)`,
      transactionCount: sql<number>`COUNT(*)::int`,
    })
    .from(platformRevenue)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return result[0];
}

export async function getPlatformRevenueByOrganization(organizationId: string) {
  const result = await db
    .select({
      totalFees: sql<string>`COALESCE(SUM(${platformRevenue.feeAmount}), 0)`,
      totalGasCosts: sql<string>`COALESCE(SUM(${platformRevenue.gasCost}), 0)`,
      totalNetRevenue: sql<string>`COALESCE(SUM(${platformRevenue.netRevenue}), 0)`,
      transactionCount: sql<number>`COUNT(*)::int`,
    })
    .from(platformRevenue)
    .where(eq(platformRevenue.organizationId, organizationId));

  return result[0];
}

// ============================================================================
// DEAD LETTER QUEUE
// ============================================================================

export async function getUnprocessedDeadLetters(limit = 10) {
  return await db
    .select()
    .from(deadLetterQueue)
    .where(eq(deadLetterQueue.processed, false))
    .orderBy(deadLetterQueue.createdAt)
    .limit(limit);
}

export async function markDeadLetterProcessed(id: string) {
  await db
    .update(deadLetterQueue)
    .set({ processed: true, processedAt: new Date() })
    .where(eq(deadLetterQueue.id, id));
}

// ============================================================================
// CUSTOMER QUERIES (for customer dashboard)
// ============================================================================

export async function getCustomerPurchases(walletAddress: string) {
  return await db.query.paymentSessions.findMany({
    where: and(
      eq(paymentSessions.customerWallet, walletAddress),
      eq(paymentSessions.status, 'completed')
    ),
    with: {
      product: {
        with: {
          organization: true,
        },
      },
      payments: {
        where: eq(payments.status, 'confirmed'),
      },
    },
    orderBy: [desc(paymentSessions.confirmedAt)],
  });
}

export async function getCustomerStats(walletAddress: string) {
  const result = await db
    .select({
      totalSpent: sql<string>`COALESCE(SUM(${payments.totalAmount}), 0)`,
      totalPurchases: sql<number>`COUNT(*)::int`,
    })
    .from(payments)
    .innerJoin(paymentSessions, eq(payments.sessionId, paymentSessions.id))
    .where(
      and(
        eq(paymentSessions.customerWallet, walletAddress),
        eq(payments.status, 'confirmed')
      )
    );

  return result[0];
}

// ============================================================================
// PURCHASE QUERIES
// ============================================================================

export async function createPurchase(data: {
  productId: string;
  sessionId: string;
  paymentId: string;
  organizationId: string;
  customerWallet: string;
  customerEmail: string | null;
  pricePaid: string;
  txSignature: string;
  maxDownloads: number;
  metadata?: any;
}) {
  const result = await db
    .insert(purchases)
    .values({
      ...data,
      status: 'completed',
    })
    .returning();

  return result[0];
}

export async function getPurchaseById(purchaseId: string) {
  const result = await db.query.purchases.findFirst({
    where: eq(purchases.id, purchaseId),
    with: {
      product: {
        with: {
          organization: true,
        },
      },
      downloadLinks: {
        orderBy: [desc(downloadLinks.createdAt)],
        limit: 5,
      },
    },
  });

  return result || null;
}

export async function getPurchasesByWallet(walletAddress: string, limit = 50) {
  return await db.query.purchases.findMany({
    where: eq(purchases.customerWallet, walletAddress),
    with: {
      product: {
        with: {
          organization: true,
        },
      },
      downloadLinks: {
        orderBy: [desc(downloadLinks.createdAt)],
        limit: 1,
      },
    },
    orderBy: [desc(purchases.createdAt)],
    limit,
  });
}

export async function getPurchaseByTxSignature(txSignature: string) {
  const result = await db.query.purchases.findFirst({
    where: eq(purchases.txSignature, txSignature),
    with: {
      product: true,
    },
  });

  return result || null;
}

export async function incrementDownloadCount(purchaseId: string) {
  const result = await db
    .update(purchases)
    .set({
      downloadCount: sql`${purchases.downloadCount} + 1`,
      lastDownloadAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(purchases.id, purchaseId))
    .returning();

  return result[0];
}

// ============================================================================
// DOWNLOAD LINK QUERIES
// ============================================================================

function generateSecureToken(): string {
  return crypto.randomUUID().toString();
}

export async function createDownloadLink(data: {
  purchaseId: string;
  productId: string;
  customerWallet: string;
  expiryHours: number;
}) {
  const token = generateSecureToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + data.expiryHours);

  const result = await db
    .insert(downloadLinks)
    .values({
      purchaseId: data.purchaseId,
      productId: data.productId,
      customerWallet: data.customerWallet,
      token,
      expiresAt,
    })
    .returning();

  return result[0];
}

export async function getDownloadLinkByToken(token: string) {
  const result = await db.query.downloadLinks.findFirst({
    where: eq(downloadLinks.token, token),
    with: {
      purchase: {
        with: {
          product: true,
        },
      },
      product: true,
    },
  });

  return result || null;
}

export async function markDownloadLinkAsUsed(
  linkId: string,
  ipAddress?: string,
  userAgent?: string
) {
  const result = await db
    .update(downloadLinks)
    .set({
      isUsed: true,
      usedAt: new Date(),
      ipAddress,
      userAgent,
    })
    .where(eq(downloadLinks.id, linkId))
    .returning();

  return result[0];
}

export async function getActiveDownloadLink(
  purchaseId: string,
  customerWallet: string
) {
  const now = new Date();

  const result = await db.query.downloadLinks.findFirst({
    where: and(
      eq(downloadLinks.purchaseId, purchaseId),
      eq(downloadLinks.customerWallet, customerWallet),
      gte(downloadLinks.expiresAt, now),
      eq(downloadLinks.isUsed, false)
    ),
    orderBy: [desc(downloadLinks.createdAt)],
  });

  return result || null;
}

export async function cleanupExpiredLinks() {
  const now = new Date();
  
  const result = await db
    .delete(downloadLinks)
    .where(lte(downloadLinks.expiresAt, now))
    .returning();

  return result.length;
}

// ============================================================================
// PRODUCT QUERIES (Enhanced for Digital Products)
// ============================================================================

export async function updateProductFile(productId: string, data: {
  supabaseFileId: string;
  supabaseBucket: string;
  fileSize: number;
  fileType: string;
}) {
  const result = await db
    .update(products)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(products.id, productId))
    .returning();

  return result[0];
}

export async function getProductsWithPurchaseInfo(walletAddress: string) {
  // Get all products and join with user's purchases
  const allProducts = await db.query.products.findMany({
    where: eq(products.isActive, true),
    with: {
      organization: {
        columns: {
          id: true,
          name: true,
          logoUrl: true,
        },
      },
    },
  });

  const userPurchases = await db.query.purchases.findMany({
    where: eq(purchases.customerWallet, walletAddress),
    columns: {
      productId: true,
    },
  });

  const purchasedProductIds = new Set(userPurchases.map(p => p.productId));

  return allProducts.map(product => ({
    ...product,
    isPurchased: purchasedProductIds.has(product.id),
    displayPrice: `$${(parseFloat(product.price) / Math.pow(10, product.tokenDecimals)).toFixed(2)}`,
  }));
}

// ============================================================================
// ANALYTICS
// ============================================================================

export async function getProductSalesStats(productId: string) {
  const result = await db
    .select({
      totalSales: sql<number>`COUNT(*)::int`,
      totalRevenue: sql<string>`COALESCE(SUM(${purchases.pricePaid}), 0)`,
      totalDownloads: sql<number>`COALESCE(SUM(${purchases.downloadCount}), 0)::int`,
    })
    .from(purchases)
    .where(
      and(
        eq(purchases.productId, productId),
        eq(purchases.status, 'completed')
      )
    );

  return result[0];
}

export async function getOrganizationSalesStats(organizationId: string) {
  const result = await db
    .select({
      totalSales: sql<number>`COUNT(*)::int`,
      totalRevenue: sql<string>`COALESCE(SUM(${purchases.pricePaid}), 0)`,
      uniqueCustomers: sql<number>`COUNT(DISTINCT ${purchases.customerWallet})::int`,
    })
    .from(purchases)
    .where(
      and(
        eq(purchases.organizationId, organizationId),
        eq(purchases.status, 'completed')
      )
    );

  return result[0];
}

export async function getTopSellingProducts(organizationId: string, limit = 10) {
  return await db
    .select({
      product: products,
      salesCount: sql<number>`COUNT(${purchases.id})::int`,
      revenue: sql<string>`COALESCE(SUM(${purchases.pricePaid}), 0)`,
    })
    .from(products)
    .leftJoin(purchases, eq(products.id, purchases.productId))
    .where(eq(products.organizationId, organizationId))
    .groupBy(products.id)
    .orderBy(desc(sql`COUNT(${purchases.id})`))
    .limit(limit);
}

export async function getAllCategories(includeInactive = false) {
  const conditions = [];
  
  if (!includeInactive) {
    conditions.push(eq(categories.isActive, true));
  }

  return await db.query.categories.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [asc(categories.displayOrder), asc(categories.name)],
  });
}

export async function getTopLevelCategories(includeInactive = false) {
  const conditions = [isNull(categories.parentId)];
  
  if (!includeInactive) {
    conditions.push(eq(categories.isActive, true));
  }

  return await db.query.categories.findMany({
    where: and(...conditions),
    orderBy: [asc(categories.displayOrder), asc(categories.name)],
    with: {
      children: {
        where: includeInactive ? undefined : eq(categories.isActive, true),
        orderBy: [asc(categories.displayOrder), asc(categories.name)],
      },
    },
  });
}

export async function getCategoryBySlug(slug: string) {
  const result = await db.query.categories.findFirst({
    where: and(
      eq(categories.slug, slug),
      eq(categories.isActive, true)
    ),
    with: {
      children: {
        where: eq(categories.isActive, true),
        orderBy: [asc(categories.displayOrder), asc(categories.name)],
      },
      parent: true,
    },
  });

  return result || null;
}

export async function getCategoryById(categoryId: string) {
  const result = await db.query.categories.findFirst({
    where: eq(categories.id, categoryId),
    with: {
      children: {
        orderBy: [asc(categories.displayOrder), asc(categories.name)],
      },
      parent: true,
    },
  });

  return result || null;
}

export async function getSubCategories(parentId: string, includeInactive = false) {
  const conditions = [eq(categories.parentId, parentId)];
  
  if (!includeInactive) {
    conditions.push(eq(categories.isActive, true));
  }

  return await db.query.categories.findMany({
    where: and(...conditions),
    orderBy: [asc(categories.displayOrder), asc(categories.name)],
  });
}

export async function createCategory(data: {
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  imageUrl?: string;
  parentId?: string;
  displayOrder?: number;
  isActive?: boolean;
}) {
  const result = await db
    .insert(categories)
    .values({
      ...data,
      displayOrder: data.displayOrder || 0,
      isActive: data.isActive ?? true,
    })
    .returning();

  return result[0];
}

export async function updateCategory(
  categoryId: string,
  data: Partial<typeof categories.$inferInsert>
) {
  const result = await db
    .update(categories)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(categories.id, categoryId))
    .returning();

  return result[0];
}

export async function deleteCategory(categoryId: string) {
  // Soft delete by setting isActive to false
  const result = await db
    .update(categories)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(categories.id, categoryId))
    .returning();

  return result[0];
}

export async function getCategoryWithProductCount(categoryId: string) {
  const category = await db.query.categories.findFirst({
    where: eq(categories.id, categoryId),
    with: {
      products: {
        where: and(
          eq(products.isActive, true),
          eq(products.categoryId, categoryId)
        ),
        columns: { id: true },
      },
    },
  });

  if (!category) return null;

  return {
    ...category,
    productCount: category.products?.length || 0,
  };
}

export async function getAllCategoriesWithProductCounts() {
  const allCategories = await db.query.categories.findMany({
    where: eq(categories.isActive, true),
    orderBy: [asc(categories.displayOrder), asc(categories.name)],
    with: {
      products: {
        where: eq(products.isActive, true),
        columns: { id: true },
      },
    },
  });

  return allCategories.map(cat => ({
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
    description: cat.description,
    icon: cat.icon,
    imageUrl: cat.imageUrl,
    parentId: cat.parentId,
    displayOrder: cat.displayOrder,
    isActive: cat.isActive,
    productCount: cat.products?.length || 0,
    createdAt: cat.createdAt,
    updatedAt: cat.updatedAt,
  }));
}

export async function getProductsByCategory(
  categorySlugOrId: string,
  limit = 50
) {
  // Try to find by slug first, then by ID
  const category = await db.query.categories.findFirst({
    where: sql`${categories.slug} = ${categorySlugOrId} OR ${categories.id} = ${categorySlugOrId}`,
  });

  if (!category) return [];

  return await db.query.products.findMany({
    where: and(
      eq(products.categoryId, category.id),
      eq(products.isActive, true)
    ),
    with: {
      organization: {
        columns: {
          id: true,
          name: true,
          logoUrl: true,
        },
      },
    },
    orderBy: [desc(products.purchaseCount), desc(products.createdAt)],
    limit,
  });
}

/**
 * Get product by slug (works with unique slugs like "react-course-a3f9k2")
 */
export async function getProductBySlug(slug: string) {
  const result = await db.query.products.findFirst({
    where: and(eq(products.slug, slug), eq(products.isActive, true)),
    with: {
      organization: true,
      category: true,
    },
  });

  return result || null;
}

/**
 * Get product by ID or slug (tries both)
 */
export async function getProductByIdOrSlug(identifier: string) {
  // Try by ID first (UUID format)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  if (uuidRegex.test(identifier)) {
    const product = await getProductById(identifier);
    if (product) return product;
  }
  
  // Try by slug
  return await getProductBySlug(identifier);
}

/**
 * Check if a slug already exists
 */
export async function slugExists(slug: string): Promise<boolean> {
  const result = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.slug, slug))
    .limit(1);

  return result.length > 0;
}

/**
 * Generate a guaranteed unique slug
 */
export async function generateUniqueProductSlug(baseName: string): Promise<string> {
  const { generateUniqueSlug } = await import('@/lib/utils/slug');
  
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    const slug = generateUniqueSlug(baseName, 6);
    const exists = await slugExists(slug);
    
    if (!exists) {
      return slug;
    }
    
    attempts++;
  }
  
  // Fallback: use longer suffix
  return generateUniqueSlug(baseName, 8);
}
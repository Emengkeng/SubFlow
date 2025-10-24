import { desc, and, eq, lte, sql, inArray } from 'drizzle-orm';
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
  type Organization,
  type Product,
  type PaymentSession,
  type Payment,
} from './schema';

// ============================================================================
// ORGANIZATION QUERIES
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

// ============================================================================
// PRODUCT QUERIES
// ============================================================================

export async function createProduct(data: {
  organizationId: string;
  name: string;
  description?: string;
  price: string;
  tokenMint: string;
  tokenDecimals?: number;
  merchantWallet: string;
  imageUrl?: string;
  metadata?: any;
}) {
  const result = await db
    .insert(products)
    .values({
      ...data,
      tokenDecimals: data.tokenDecimals || 6,
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

export async function updateProduct(
  productId: string,
  data: Partial<Product>
) {
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

// ============================================================================
// PAYMENT SESSION QUERIES
// ============================================================================

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

// ============================================================================
// PAYMENT QUERIES
// ============================================================================

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

export async function updatePayment(
  paymentId: string,
  data: Partial<Payment>
) {
  const result = await db
    .update(payments)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(payments.id, paymentId))
    .returning();

  return result[0];
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
// WEBHOOK QUERIES
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
  return await db
    .select()
    .from(webhooks)
    .where(eq(webhooks.status, 'pending'))
    .orderBy(webhooks.createdAt)
    .limit(limit);
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

export async function getPlatformConfig() {
  const result = await db
    .select()
    .from(platformConfig)
    .limit(1);

  return result[0] || null;
}

export async function updatePlatformConfig(data: Partial<typeof platformConfig.$inferInsert>) {
  const result = await db
    .update(platformConfig)
    .set({ ...data, updatedAt: new Date() })
    .returning();

  return result[0];
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

export async function addToDeadLetterQueue(data: {
  paymentId?: string;
  sessionId?: string;
  errorType: string;
  errorMessage: string;
  metadata: any;
}) {
  await db.insert(deadLetterQueue).values(data);
}

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
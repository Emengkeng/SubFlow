import { desc, and, eq, lte, isNull, sql } from 'drizzle-orm';
import { db } from './drizzle';
import {
  organizations,
  plans,
  subscriptions,
  payments,
  paymentErrors,
  webhooks,
  deadLetterQueue,
  platformConfig, 
  platformRevenue,
  type Subscription,
  type Payment,
  type Plan,
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
}) {
  const result = await db
    .insert(organizations)
    .values(data)
    .returning();

  return result[0];
}

// ============================================================================
// PLAN QUERIES
// ============================================================================

export async function getPlanById(planId: string) {
  const result = await db.query.plans.findFirst({
    where: and(eq(plans.id, planId), eq(plans.isActive, true)),
    with: {
      organization: true,
    },
  });

  return result || null;
}

export async function getPlansByOrganization(organizationId: string) {
  return await db
    .select()
    .from(plans)
    .where(eq(plans.organizationId, organizationId))
    .orderBy(desc(plans.createdAt));
}

export async function createPlan(data: {
  organizationId: string;
  name: string;
  description?: string;
  tokenMint: string;
  amountPerBilling: string;
  billingPeriodDays: number;
  merchantTokenAccount: string;
  tokenDecimals?: number;
}) {
  const result = await db
    .insert(plans)
    .values(data)
    .returning();

  return result[0];
}

// ============================================================================
// SUBSCRIPTION QUERIES
// ============================================================================

export async function getDueSubscriptions(limit = 100) {
  return await db.query.subscriptions.findMany({
    where: and(
      eq(subscriptions.status, 'active'),
      lte(subscriptions.nextBillingDate, new Date()),
      sql`(${subscriptions.delegateExpiry} IS NULL OR ${subscriptions.delegateExpiry} > NOW())`
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

export async function getSubscriptionById(subscriptionId: string) {
  return await db.query.subscriptions.findFirst({
    where: eq(subscriptions.id, subscriptionId),
    with: {
      plan: {
        with: {
          organization: true,
        },
      },
      payments: {
        limit: 10,
        orderBy: [desc(payments.createdAt)],
      },
    },
  });
}

export async function getSubscriptionsByWallet(walletAddress: string) {
  return await db.query.subscriptions.findMany({
    where: eq(subscriptions.userWallet, walletAddress),
    with: {
      plan: {
        with: {
          organization: true,
        },
      },
      payments: {
        where: eq(payments.status, 'confirmed'),
        orderBy: [desc(payments.createdAt)],
      },
    },
    orderBy: [desc(subscriptions.createdAt)],
  });
}

export async function createSubscription(data: {
  planId: string;
  userWallet: string;
  userTokenAccount: string;
  merchantTokenAccount: string;
  tokenMint: string;
  tokenDecimals: number;
  amountPerBilling: string;
  nextBillingDate: Date;
}) {
  const result = await db
    .insert(subscriptions)
    .values(data)
    .returning();

  return result[0];
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

export async function checkPendingPayment(subscriptionId: string): Promise<boolean> {
  const result = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.subscriptionId, subscriptionId),
        sql`${payments.status} IN ('pending', 'sent')`,
        sql`${payments.createdAt} > NOW() - INTERVAL '1 hour'`
      )
    )
    .limit(1);

  return result.length > 0;
}

// ============================================================================
// PAYMENT QUERIES
// ============================================================================

export async function createPayment(data: {
  subscriptionId: string;
  amount: string;
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

export async function getPaymentsBySubscription(subscriptionId: string) {
  return await db
    .select()
    .from(payments)
    .where(eq(payments.subscriptionId, subscriptionId))
    .orderBy(desc(payments.createdAt))
    .limit(50);
}

export async function getFailedPayments(limit = 100) {
  return await db.query.payments.findMany({
    where: sql`${payments.status} IN ('failed', 'requires_action')`,
    with: {
      subscription: {
        with: {
          plan: {
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
// PAYMENT ERROR QUERIES
// ============================================================================

export async function createPaymentError(data: {
  paymentId: string;
  attemptNumber: number;
  errorType: string;
  errorMessage: string;
  isRetryable: boolean;
}) {
  await db.insert(paymentErrors).values(data);
}

export async function getPaymentErrors(paymentId: string) {
  return await db
    .select()
    .from(paymentErrors)
    .where(eq(paymentErrors.paymentId, paymentId))
    .orderBy(desc(paymentErrors.createdAt));
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

// ============================================================================
// DEAD LETTER QUEUE QUERIES
// ============================================================================

export async function addToDeadLetterQueue(data: {
  paymentId?: string;
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

// ============================================================================
// ANALYTICS QUERIES
// ============================================================================

export async function getSubscriptionMetrics() {
  const [statusCounts, recentPayments] = await Promise.all([
    db
      .select({
        status: subscriptions.status,
        count: sql<number>`count(*)::int`,
      })
      .from(subscriptions)
      .groupBy(subscriptions.status),
    
    db
      .select({
        status: payments.status,
        count: sql<number>`count(*)::int`,
        totalAmount: sql<string>`sum(${payments.amount})`,
      })
      .from(payments)
      .where(sql`${payments.createdAt} > NOW() - INTERVAL '24 hours'`)
      .groupBy(payments.status),
  ]);

  return {
    subscriptions: statusCounts,
    payments24h: recentPayments,
  };
}

export async function getOrganizationRevenue(organizationId: string) {
  const result = await db
    .select({
      totalRevenue: sql<string>`sum(${payments.amount})`,
      confirmedPayments: sql<number>`count(*)::int`,
    })
    .from(payments)
    .innerJoin(subscriptions, eq(payments.subscriptionId, subscriptions.id))
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .where(
      and(
        eq(plans.organizationId, organizationId),
        eq(payments.status, 'confirmed')
      )
    );

  return result[0];
}

// ============================================================================
// MONTHLY SPENDING RESET
// ============================================================================

export async function resetMonthlySpending() {
  await db
    .update(subscriptions)
    .set({
      currentMonthSpent: '0',
      lastResetDate: new Date(),
    })
    .where(
      and(
        sql`${subscriptions.lastResetDate} < DATE_TRUNC('month', NOW())`,
        eq(subscriptions.status, 'active')
      )
    );
}


/**
 * Gets all active subscriptions for a user across all organizations
 * Optimized for handling multiple subscriptions efficiently
 */
export async function getUserActiveSubscriptions(userWallet: string) {
  return await db.query.subscriptions.findMany({
    where: and(
      eq(subscriptions.userWallet, userWallet),
      eq(subscriptions.status, 'active')
    ),
    with: {
      plan: {
        with: {
          organization: {
            columns: {
              id: true,
              name: true,
              logoUrl: true,
            },
          },
        },
      },
      payments: {
        where: eq(payments.status, 'confirmed'),
        orderBy: [desc(payments.createdAt)],
        limit: 5, // Last 5 payments per subscription
      },
    },
    orderBy: [desc(subscriptions.createdAt)],
  });
}

/**
 * Checks if user can subscribe to a plan
 * Prevents duplicate active subscriptions to the same plan
 */
export async function canUserSubscribeToPlan(
  userWallet: string,
  planId: string
): Promise<{ canSubscribe: boolean; reason?: string }> {
  // Check for existing active/pending subscription to this specific plan
  const existingSubscription = await db.query.subscriptions.findFirst({
    where: and(
      eq(subscriptions.userWallet, userWallet),
      eq(subscriptions.planId, planId),
      sql`${subscriptions.status} IN ('active', 'pending_approval')`
    ),
  });

  if (existingSubscription) {
    return {
      canSubscribe: false,
      reason: 'You already have an active subscription to this plan',
    };
  }

  return { canSubscribe: true };
}

/**
 * Gets subscription statistics for a user
 */
export async function getUserSubscriptionStats(userWallet: string) {
  const [subscriptionCounts, totalSpent] = await Promise.all([
    // Count by status
    db
      .select({
        status: subscriptions.status,
        count: sql<number>`count(*)::int`,
      })
      .from(subscriptions)
      .where(eq(subscriptions.userWallet, userWallet))
      .groupBy(subscriptions.status),

    // Total amount spent (confirmed payments only)
    db
      .select({
        total: sql<string>`COALESCE(sum(${payments.amount}), 0)`,
        count: sql<number>`count(*)::int`,
      })
      .from(payments)
      .innerJoin(subscriptions, eq(payments.subscriptionId, subscriptions.id))
      .where(
        and(
          eq(subscriptions.userWallet, userWallet),
          eq(payments.status, 'confirmed')
        )
      ),
  ]);

  return {
    subscriptionsByStatus: subscriptionCounts,
    totalSpent: totalSpent[0]?.total || '0',
    totalPayments: totalSpent[0]?.count || 0,
  };
}

/**
 * Batch processing: Get due subscriptions grouped by organization
 * This allows parallel processing per organization to avoid conflicts
 */
export async function getDueSubscriptionsGroupedByOrg(limit = 100) {
  const dueSubscriptions = await db.query.subscriptions.findMany({
    where: and(
      eq(subscriptions.status, 'active'),
      lte(subscriptions.nextBillingDate, new Date()),
      sql`(${subscriptions.delegateExpiry} IS NULL OR ${subscriptions.delegateExpiry} > NOW())`
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

  // Group by organization for efficient batch processing
  const grouped = dueSubscriptions.reduce((acc, sub) => {
    const orgId = sub.plan.organizationId;
    if (!acc[orgId]) {
      acc[orgId] = [];
    }
    acc[orgId].push(sub);
    return acc;
  }, {} as Record<string, typeof dueSubscriptions>);

  return grouped;
}

/**
 * Gets all organizations a user is subscribed to
 */
export async function getUserOrganizations(userWallet: string) {
  const result = await db
    .selectDistinct({
      id: organizations.id,
      name: organizations.name,
      logoUrl: organizations.logoUrl,
      activeSubscriptions: sql<number>`count(${subscriptions.id})::int`,
    })
    .from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .innerJoin(organizations, eq(plans.organizationId, organizations.id))
    .where(
      and(
        eq(subscriptions.userWallet, userWallet),
        eq(subscriptions.status, 'active')
      )
    )
    .groupBy(organizations.id, organizations.name, organizations.logoUrl);

  return result;
}

/**
 * Bulk cancel subscriptions (e.g., user wants to cancel all)
 */
export async function bulkCancelSubscriptions(
  subscriptionIds: string[],
  userWallet: string
) {
  // Verify ownership of all subscriptions
  const verified = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(
      and(
        inArray(subscriptions.id, subscriptionIds),
        eq(subscriptions.userWallet, userWallet),
        eq(subscriptions.status, 'active')
      )
    );

  if (verified.length !== subscriptionIds.length) {
    throw new Error('Some subscriptions could not be verified or are not active');
  }

  // Bulk update
  await db
    .update(subscriptions)
    .set({ 
      status: 'cancelled', 
      updatedAt: new Date() 
    })
    .where(inArray(subscriptions.id, subscriptionIds));

  return verified;
}

/**
 * Get upcoming payments for a user (next 30 days)
 */
export async function getUpcomingPayments(userWallet: string) {
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const upcoming = await db.query.subscriptions.findMany({
    where: and(
      eq(subscriptions.userWallet, userWallet),
      eq(subscriptions.status, 'active'),
      lte(subscriptions.nextBillingDate, thirtyDaysFromNow)
    ),
    with: {
      plan: {
        with: {
          organization: {
            columns: {
              id: true,
              name: true,
              logoUrl: true,
            },
          },
        },
      },
    },
    orderBy: [subscriptions.nextBillingDate],
  });

  return upcoming.map((sub) => ({
    subscriptionId: sub.id,
    organizationName: sub.plan.organization.name,
    organizationLogo: sub.plan.organization.logoUrl,
    planName: sub.plan.name,
    amount: sub.amountPerBilling,
    dueDate: sub.nextBillingDate,
    daysUntilDue: Math.ceil(
      (sub.nextBillingDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    ),
  }));
}

/**
 * Calculate total monthly recurring revenue for a user
 */
export async function getUserMonthlyRecurringCost(userWallet: string) {
  const activeSubscriptions = await db
    .select({
      amount: subscriptions.amountPerBilling,
      billingPeriodDays: plans.billingPeriodDays,
    })
    .from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .where(
      and(
        eq(subscriptions.userWallet, userWallet),
        eq(subscriptions.status, 'active')
      )
    );

  // Normalize to monthly cost (30 days)
  const monthlyTotal = activeSubscriptions.reduce((total, sub) => {
    const dailyCost = BigInt(sub.amount) / BigInt(sub.billingPeriodDays);
    const monthlyCost = dailyCost * BigInt(30);
    return total + monthlyCost;
  }, BigInt(0));

  return {
    monthlyTotal: monthlyTotal.toString(),
    subscriptionCount: activeSubscriptions.length,
  };
}

/**
 * Search and filter plans across all organizations
 */
export async function searchPlans(query: {
  search?: string;
  organizationId?: string;
  minAmount?: string;
  maxAmount?: string;
  billingPeriod?: number;
}) {
  let conditions = [eq(plans.isActive, true)];

  if (query.organizationId) {
    conditions.push(eq(plans.organizationId, query.organizationId));
  }

  if (query.minAmount) {
    conditions.push(sql`${plans.amountPerBilling} >= ${query.minAmount}`);
  }

  if (query.maxAmount) {
    conditions.push(sql`${plans.amountPerBilling} <= ${query.maxAmount}`);
  }

  if (query.billingPeriod) {
    conditions.push(eq(plans.billingPeriodDays, query.billingPeriod));
  }

  if (query.search) {
    conditions.push(
      sql`(${plans.name} ILIKE ${'%' + query.search + '%'} OR ${plans.description} ILIKE ${'%' + query.search + '%'})`
    );
  }

  return await db.query.plans.findMany({
    where: and(...conditions),
    with: {
      organization: {
        columns: {
          id: true,
          name: true,
          logoUrl: true,
        },
      },
    },
    orderBy: [desc(plans.createdAt)],
    limit: 50,
  });
}

// ============================================================================
// PLARTFORM FEE ANALYTICS
// ============================================================================

export async function getPlatformConfig() {
  const result = await db
    .select()
    .from(platformConfig)
    .limit(1);

  return result[0] || null;
}

export async function createPlatformRevenue(data: {
  paymentId: string;
  subscriptionId: string;
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
  let query = db
    .select({
      totalFees: sql<string>`COALESCE(SUM(${platformRevenue.feeAmount}), 0)`,
      totalGasCosts: sql<string>`COALESCE(SUM(${platformRevenue.gasCost}), 0)`,
      totalNetRevenue: sql<string>`COALESCE(SUM(${platformRevenue.netRevenue}), 0)`,
      transactionCount: sql<number>`COUNT(*)::int`,
    })
    .from(platformRevenue);

  if (startDate && endDate) {
    query = query.where(
      and(
        sql`${platformRevenue.createdAt} >= ${startDate}`,
        sql`${platformRevenue.createdAt} <= ${endDate}`
      )
    );
  }

  const result = await query;
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
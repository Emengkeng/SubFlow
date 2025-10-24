import { desc, and, eq, lte, sql } from 'drizzle-orm';
import { db } from '../db/drizzle';
import {
  subscriptionPlans,
  subscriptions,
  subscriptionPayments,
  webhooks,
  organizations,
  type Subscription,
  type SubscriptionPlan,
  type NewWebhook,
} from '../db/schema';

// ============================================================================
// SUBSCRIPTION PLAN QUERIES
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
// SUBSCRIPTION QUERIES
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
// SUBSCRIPTION PAYMENT QUERIES
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

export async function getFailedSubscriptionPayments(limit = 100) {
  return await db.query.subscriptionPayments.findMany({
    where: eq(subscriptionPayments.status, 'failed'),
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
    orderBy: [desc(subscriptionPayments.updatedAt)],
  });
}

// ============================================================================
// ANALYTICS
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
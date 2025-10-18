import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  numeric,
  bigint,
  jsonb,
  uuid,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// SUBSCRIPTION SYSTEM TABLES
// ============================================================================

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  apiKey: varchar('api_key', { length: 255 }).notNull().unique(),
  webhookUrl: text('webhook_url'),
  webhookSecret: varchar('webhook_secret', { length: 255 }),
  logoUrl: text('logo_url'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const plans = pgTable('plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  tokenMint: varchar('token_mint', { length: 44 }).notNull(),
  tokenDecimals: integer('token_decimals').notNull().default(6),
  amountPerBilling: numeric('amount_per_billing', { precision: 20, scale: 0 }).notNull(),
  billingPeriodDays: integer('billing_period_days').notNull(),
  merchantTokenAccount: varchar('merchant_token_account', { length: 44 }).notNull(),
  maxMonthlyCap: numeric('max_monthly_cap', { precision: 20, scale: 0 }),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  planId: uuid('plan_id')
    .notNull()
    .references(() => plans.id, { onDelete: 'cascade' }),
  userWallet: varchar('user_wallet', { length: 44 }).notNull(),
  userTokenAccount: varchar('user_token_account', { length: 44 }).notNull(),
  merchantTokenAccount: varchar('merchant_token_account', { length: 44 }).notNull(),
  tokenMint: varchar('token_mint', { length: 44 }).notNull(),
  tokenDecimals: integer('token_decimals').notNull().default(6),
  amountPerBilling: numeric('amount_per_billing', { precision: 20, scale: 0 }).notNull(),
  delegateSignature: varchar('delegate_signature', { length: 128 }),
  delegateExpiry: timestamp('delegate_expiry'),
  nextBillingDate: timestamp('next_billing_date').notNull(),
  status: varchar('status', { length: 50 }).notNull().default('pending_approval'),
  monthlyCap: numeric('monthly_cap', { precision: 20, scale: 0 }),
  currentMonthSpent: numeric('current_month_spent', { precision: 20, scale: 0 }).default('0'),
  lastResetDate: timestamp('last_reset_date').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  uniqueActiveSubscription: uniqueIndex('unique_active_subscription')
    .on(table.planId, table.userWallet, table.status),
}));

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  subscriptionId: uuid('subscription_id')
    .notNull()
    .references(() => subscriptions.id, { onDelete: 'cascade' }),
  amount: numeric('amount', { precision: 20, scale: 0 }).notNull(),
  txSignature: varchar('tx_signature', { length: 128 }),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  retryCount: integer('retry_count').default(0),
  errorMessage: text('error_message'),
  deliveryMethod: varchar('delivery_method', { length: 100 }),
  priorityFee: numeric('priority_fee', { precision: 20, scale: 0 }),
  slotSent: bigint('slot_sent', { mode: 'number' }),
  slotConfirmed: bigint('slot_confirmed', { mode: 'number' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const paymentErrors = pgTable('payment_errors', {
  id: uuid('id').primaryKey().defaultRandom(),
  paymentId: uuid('payment_id')
    .notNull()
    .references(() => payments.id, { onDelete: 'cascade' }),
  attemptNumber: integer('attempt_number').notNull(),
  errorType: varchar('error_type', { length: 100 }).notNull(),
  errorMessage: text('error_message').notNull(),
  isRetryable: boolean('is_retryable').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const webhooks = pgTable('webhooks', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  payload: jsonb('payload').notNull(),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  retryCount: integer('retry_count').default(0),
  responseStatus: integer('response_status'),
  responseBody: text('response_body'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  sentAt: timestamp('sent_at'),
});

export const deadLetterQueue = pgTable('dead_letter_queue', {
  id: uuid('id').primaryKey().defaultRandom(),
  paymentId: uuid('payment_id').references(() => payments.id, { onDelete: 'set null' }),
  errorType: varchar('error_type', { length: 100 }).notNull(),
  errorMessage: text('error_message').notNull(),
  metadata: jsonb('metadata'),
  processed: boolean('processed').default(false),
  processedAt: timestamp('processed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ============================================================================
// RELATIONS
// ============================================================================

export const organizationsRelations = relations(organizations, ({ many }) => ({
  plans: many(plans),
  webhooks: many(webhooks),
}));

export const plansRelations = relations(plans, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [plans.organizationId],
    references: [organizations.id],
  }),
  subscriptions: many(subscriptions),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  plan: one(plans, {
    fields: [subscriptions.planId],
    references: [plans.id],
  }),
  payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one, many }) => ({
  subscription: one(subscriptions, {
    fields: [payments.subscriptionId],
    references: [subscriptions.id],
  }),
  errors: many(paymentErrors),
}));

export const paymentErrorsRelations = relations(paymentErrors, ({ one }) => ({
  payment: one(payments, {
    fields: [paymentErrors.paymentId],
    references: [payments.id],
  }),
}));

export const webhooksRelations = relations(webhooks, ({ one }) => ({
  organization: one(organizations, {
    fields: [webhooks.organizationId],
    references: [organizations.id],
  }),
}));

export const deadLetterQueueRelations = relations(deadLetterQueue, ({ one }) => ({
  payment: one(payments, {
    fields: [deadLetterQueue.paymentId],
    references: [payments.id],
  }),
}));

// ============================================================================
// TYPES
// ============================================================================

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type Plan = typeof plans.$inferSelect;
export type NewPlan = typeof plans.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type PaymentError = typeof paymentErrors.$inferSelect;
export type NewPaymentError = typeof paymentErrors.$inferInsert;
export type Webhook = typeof webhooks.$inferSelect;
export type NewWebhook = typeof webhooks.$inferInsert;
export type DeadLetterQueueItem = typeof deadLetterQueue.$inferSelect;
export type NewDeadLetterQueueItem = typeof deadLetterQueue.$inferInsert;

export enum SubscriptionStatus {
  PENDING_APPROVAL = 'pending_approval',
  ACTIVE = 'active',
  PAUSED = 'paused',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

export enum PaymentStatus {
  PENDING = 'pending',
  SENT = 'sent',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
  REQUIRES_ACTION = 'requires_action',
}
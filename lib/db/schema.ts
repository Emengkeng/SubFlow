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
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { length: 20 }).notNull().default('member'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

export const teams = pgTable('teams', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  stripeCustomerId: text('stripe_customer_id').unique(),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  stripeProductId: text('stripe_product_id'),
  planName: varchar('plan_name', { length: 50 }),
  subscriptionStatus: varchar('subscription_status', { length: 20 }),
});

export const teamMembers = pgTable('team_members', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  role: varchar('role', { length: 50 }).notNull(),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
});

export const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  userId: integer('user_id').references(() => users.id),
  action: text('action').notNull(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  ipAddress: varchar('ip_address', { length: 45 }),
}, (table) => ({
  teamIdIdx: index('activity_logs_team_id_idx').on(table.teamId),
  userIdIdx: index('activity_logs_user_id_idx').on(table.userId),
  timestampIdx: index('activity_logs_timestamp_idx').on(table.timestamp),
  actionIdx: index('activity_logs_action_idx').on(table.action),
}));

export const invitations = pgTable('invitations', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  email: varchar('email', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull(),
  invitedBy: integer('invited_by')
    .notNull()
    .references(() => users.id),
  invitedAt: timestamp('invited_at').notNull().defaultNow(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});


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
}, (table) => ({
  apiKeyIdx: index('organizations_api_key_idx').on(table.apiKey),
  isActiveIdx: index('organizations_is_active_idx').on(table.isActive),
}));

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

   userWalletIdx: index('subscriptions_user_wallet_idx').on(table.userWallet),
  planIdIdx: index('subscriptions_plan_id_idx').on(table.planId),
  statusIdx: index('subscriptions_status_idx').on(table.status),
  nextBillingDateIdx: index('subscriptions_next_billing_date_idx').on(table.nextBillingDate),
  
  statusAndDateIdx: index('subscriptions_status_date_idx')
    .on(table.status, table.nextBillingDate),
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
}, (table) => ({
  subscriptionIdIdx: index('payments_subscription_id_idx').on(table.subscriptionId),
  statusIdx: index('payments_status_idx').on(table.status),
  txSignatureIdx: index('payments_tx_signature_idx').on(table.txSignature),
  createdAtIdx: index('payments_created_at_idx').on(table.createdAt),
  
  subStatusIdx: index('payments_sub_status_idx')
    .on(table.subscriptionId, table.status),
}));

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
}, (table) => ({
  orgIdIdx: index('webhooks_organization_id_idx').on(table.organizationId),
  statusIdx: index('webhooks_status_idx').on(table.status),
  eventTypeIdx: index('webhooks_event_type_idx').on(table.eventType),
  createdAtIdx: index('webhooks_created_at_idx').on(table.createdAt),
}));

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

export const platformConfig = pgTable('platform_config', {
  id: serial('id').primaryKey(),
  platformFeeAmount: numeric('platform_fee_amount', { precision: 20, scale: 0 }).notNull().default('1000000'), // 1 USDC
  platformFeeWallet: varchar('platform_fee_wallet', { length: 44 }).notNull(),
  gasSponsorshipEnabled: boolean('gas_sponsorship_enabled').default(true),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const platformRevenue = pgTable('platform_revenue', {
  id: uuid('id').primaryKey().defaultRandom(),
  paymentId: uuid('payment_id')
    .notNull()
    .references(() => payments.id, { onDelete: 'cascade' }),
  subscriptionId: uuid('subscription_id')
    .notNull()
    .references(() => subscriptions.id),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id),
  feeAmount: numeric('fee_amount', { precision: 20, scale: 0 }).notNull(), // 1 USDC
  merchantAmount: numeric('merchant_amount', { precision: 20, scale: 0 }).notNull(),
  totalAmount: numeric('total_amount', { precision: 20, scale: 0 }).notNull(), // merchant + fee
  gasCost: numeric('gas_cost', { precision: 20, scale: 0 }).notNull(), // Priority fee + tip in lamports
  netRevenue: numeric('net_revenue', { precision: 20, scale: 0 }).notNull(), // fee - gas cost
  txSignature: varchar('tx_signature', { length: 128 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ============================================================================
// RELATIONS
// ============================================================================

export const platformRevenueRelations = relations(platformRevenue, ({ one }) => ({
  payment: one(payments, {
    fields: [platformRevenue.paymentId],
    references: [payments.id],
  }),
  subscription: one(subscriptions, {
    fields: [platformRevenue.subscriptionId],
    references: [subscriptions.id],
  }),
  organization: one(organizations, {
    fields: [platformRevenue.organizationId],
    references: [organizations.id],
  }),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [teams.organizationId],
    references: [organizations.id],
  }),
  teamMembers: many(teamMembers),
  activityLogs: many(activityLogs),
  invitations: many(invitations),
}));

export const usersRelations = relations(users, ({ many }) => ({
  teamMembers: many(teamMembers),
  invitationsSent: many(invitations),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  team: one(teams, {
    fields: [invitations.teamId],
    references: [teams.id],
  }),
  invitedBy: one(users, {
    fields: [invitations.invitedBy],
    references: [users.id],
  }),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  team: one(teams, {
    fields: [activityLogs.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  teams: many(teams),
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

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;
export type TeamDataWithMembers = Team & {
  teamMembers: (TeamMember & {
    user: Pick<User, 'id' | 'name' | 'email'>;
  })[];
};
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
export type PlatformConfig = typeof platformConfig.$inferSelect;
export type PlatformRevenue = typeof platformRevenue.$inferSelect;

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

export enum ActivityType {
  SIGN_UP = 'SIGN_UP',
  SIGN_IN = 'SIGN_IN',
  SIGN_OUT = 'SIGN_OUT',
  UPDATE_PASSWORD = 'UPDATE_PASSWORD',
  DELETE_ACCOUNT = 'DELETE_ACCOUNT',
  UPDATE_ACCOUNT = 'UPDATE_ACCOUNT',
  CREATE_TEAM = 'CREATE_TEAM',
  REMOVE_TEAM_MEMBER = 'REMOVE_TEAM_MEMBER',
  INVITE_TEAM_MEMBER = 'INVITE_TEAM_MEMBER',
  ACCEPT_INVITATION = 'ACCEPT_INVITATION',
}
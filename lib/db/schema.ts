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
// PAYMENT SYSTEM TABLES (Refactored)
// ============================================================================

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  apiKey: varchar('api_key', { length: 255 }).notNull().unique(),
  webhookUrl: text('webhook_url'),
  webhookSecret: varchar('webhook_secret', { length: 255 }),
  logoUrl: text('logo_url'),
  website: text('website'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  apiKeyIdx: index('organizations_api_key_idx').on(table.apiKey),
  isActiveIdx: index('organizations_is_active_idx').on(table.isActive),
}));

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  price: numeric('price', { precision: 20, scale: 0 }).notNull(), // In smallest token unit
  tokenMint: varchar('token_mint', { length: 44 }).notNull(), // USDC, SOL, etc
  tokenDecimals: integer('token_decimals').notNull().default(6),
  merchantWallet: varchar('merchant_wallet', { length: 44 }).notNull(), // Where to send funds
  imageUrl: text('image_url'),
  metadata: jsonb('metadata'), // Custom fields
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  orgIdx: index('products_org_idx').on(table.organizationId),
  activeIdx: index('products_active_idx').on(table.isActive),
}));

export const paymentSessions = pgTable('payment_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id),
  
  // Customer info
  customerWallet: varchar('customer_wallet', { length: 44 }),
  customerEmail: varchar('customer_email', { length: 255 }),
  
  // Payment details
  amount: numeric('amount', { precision: 20, scale: 0 }).notNull(),
  platformFee: numeric('platform_fee', { precision: 20, scale: 0 }).notNull(),
  totalAmount: numeric('total_amount', { precision: 20, scale: 0 }).notNull(),
  
  // Token info
  tokenMint: varchar('token_mint', { length: 44 }).notNull(),
  tokenDecimals: integer('token_decimals').notNull(),
  merchantWallet: varchar('merchant_wallet', { length: 44 }).notNull(),
  
  // Session status
  status: varchar('status', { length: 50 }).notNull().default('pending'), // pending, completed, expired, cancelled
  expiresAt: timestamp('expires_at').notNull(), // 30 min expiry
  
  // Payment transaction
  txSignature: varchar('tx_signature', { length: 128 }),
  confirmedAt: timestamp('confirmed_at'),
  
  // Metadata
  metadata: jsonb('metadata'), // Custom order data
  successUrl: text('success_url'),
  cancelUrl: text('cancel_url'),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  productIdx: index('sessions_product_idx').on(table.productId),
  statusIdx: index('sessions_status_idx').on(table.status),
  walletIdx: index('sessions_wallet_idx').on(table.customerWallet),
  txIdx: index('sessions_tx_idx').on(table.txSignature),
}));

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => paymentSessions.id, { onDelete: 'cascade' }),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id),
  
  // Amounts
  merchantAmount: numeric('merchant_amount', { precision: 20, scale: 0 }).notNull(),
  platformFee: numeric('platform_fee', { precision: 20, scale: 0 }).notNull(),
  totalAmount: numeric('total_amount', { precision: 20, scale: 0 }).notNull(),
  gasCost: numeric('gas_cost', { precision: 20, scale: 0 }).notNull(),
  
  // Transaction details
  txSignature: varchar('tx_signature', { length: 128 }).notNull().unique(),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  deliveryMethod: varchar('delivery_method', { length: 100 }),
  priorityFee: numeric('priority_fee', { precision: 20, scale: 0 }),
  slotSent: bigint('slot_sent', { mode: 'number' }),
  slotConfirmed: bigint('slot_confirmed', { mode: 'number' }),
  
  // Retry logic
  retryCount: integer('retry_count').default(0),
  errorMessage: text('error_message'),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  sessionIdx: index('payments_session_idx').on(table.sessionId),
  orgIdx: index('payments_org_idx').on(table.organizationId),
  statusIdx: index('payments_status_idx').on(table.status),
  txIdx: index('payments_tx_idx').on(table.txSignature),
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
}));

export const deadLetterQueue = pgTable('dead_letter_queue', {
  id: uuid('id').primaryKey().defaultRandom(),
  paymentId: uuid('payment_id').references(() => payments.id, { onDelete: 'set null' }),
  sessionId: uuid('session_id').references(() => paymentSessions.id, { onDelete: 'set null' }),
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
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id),
  feeAmount: numeric('fee_amount', { precision: 20, scale: 0 }).notNull(),
  merchantAmount: numeric('merchant_amount', { precision: 20, scale: 0 }).notNull(),
  totalAmount: numeric('total_amount', { precision: 20, scale: 0 }).notNull(),
  gasCost: numeric('gas_cost', { precision: 20, scale: 0 }).notNull(),
  netRevenue: numeric('net_revenue', { precision: 20, scale: 0 }).notNull(),
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
  products: many(products),
  paymentSessions: many(paymentSessions),
  payments: many(payments),
  webhooks: many(webhooks),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [products.organizationId],
    references: [organizations.id],
  }),
  paymentSessions: many(paymentSessions),
  payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  session: one(paymentSessions, {
    fields: [payments.sessionId],
    references: [paymentSessions.id],
  }),
  product: one(products, {
    fields: [payments.productId],
    references: [products.id],
  }),
  organization: one(organizations, {
    fields: [payments.organizationId],
    references: [organizations.id],
  }),
}));

export const paymentSessionsRelations = relations(paymentSessions, ({ one, many }) => ({
  product: one(products, {
    fields: [paymentSessions.productId],
    references: [products.id],
  }),
  organization: one(organizations, {
    fields: [paymentSessions.organizationId],
    references: [organizations.id],
  }),
  payments: many(payments),
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
export type PaymentError = typeof paymentErrors.$inferSelect;
export type NewPaymentError = typeof paymentErrors.$inferInsert;
export type NewWebhook = typeof webhooks.$inferInsert;
export type DeadLetterQueueItem = typeof deadLetterQueue.$inferSelect;
export type NewDeadLetterQueueItem = typeof deadLetterQueue.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type PaymentSession = typeof paymentSessions.$inferSelect;
export type NewPaymentSession = typeof paymentSessions.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type Webhook = typeof webhooks.$inferSelect;
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
}

export enum SessionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
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
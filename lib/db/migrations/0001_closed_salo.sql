CREATE TABLE "dead_letter_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid,
	"error_type" varchar(100) NOT NULL,
	"error_message" text NOT NULL,
	"metadata" jsonb,
	"processed" boolean DEFAULT false,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"api_key" varchar(255) NOT NULL,
	"webhook_url" text,
	"webhook_secret" varchar(255),
	"logo_url" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_email_unique" UNIQUE("email"),
	CONSTRAINT "organizations_api_key_unique" UNIQUE("api_key")
);
--> statement-breakpoint
CREATE TABLE "payment_errors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"error_type" varchar(100) NOT NULL,
	"error_message" text NOT NULL,
	"is_retryable" boolean NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"amount" numeric(20, 0) NOT NULL,
	"tx_signature" varchar(128),
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"retry_count" integer DEFAULT 0,
	"error_message" text,
	"delivery_method" varchar(100),
	"priority_fee" numeric(20, 0),
	"slot_sent" bigint,
	"slot_confirmed" bigint,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"token_mint" varchar(44) NOT NULL,
	"token_decimals" integer DEFAULT 6 NOT NULL,
	"amount_per_billing" numeric(20, 0) NOT NULL,
	"billing_period_days" integer NOT NULL,
	"merchant_token_account" varchar(44) NOT NULL,
	"max_monthly_cap" numeric(20, 0),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"platform_fee_amount" numeric(20, 0) DEFAULT '1000000' NOT NULL,
	"platform_fee_wallet" varchar(44) NOT NULL,
	"gas_sponsorship_enabled" boolean DEFAULT true,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_revenue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"subscription_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"fee_amount" numeric(20, 0) NOT NULL,
	"merchant_amount" numeric(20, 0) NOT NULL,
	"total_amount" numeric(20, 0) NOT NULL,
	"gas_cost" numeric(20, 0) NOT NULL,
	"net_revenue" numeric(20, 0) NOT NULL,
	"tx_signature" varchar(128),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"user_wallet" varchar(44) NOT NULL,
	"user_token_account" varchar(44) NOT NULL,
	"merchant_token_account" varchar(44) NOT NULL,
	"token_mint" varchar(44) NOT NULL,
	"token_decimals" integer DEFAULT 6 NOT NULL,
	"amount_per_billing" numeric(20, 0) NOT NULL,
	"delegate_signature" varchar(128),
	"delegate_expiry" timestamp,
	"next_billing_date" timestamp NOT NULL,
	"status" varchar(50) DEFAULT 'pending_approval' NOT NULL,
	"monthly_cap" numeric(20, 0),
	"current_month_spent" numeric(20, 0) DEFAULT '0',
	"last_reset_date" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"payload" jsonb NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"retry_count" integer DEFAULT 0,
	"response_status" integer,
	"response_body" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "dead_letter_queue" ADD CONSTRAINT "dead_letter_queue_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_errors" ADD CONSTRAINT "payment_errors_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_revenue" ADD CONSTRAINT "platform_revenue_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_revenue" ADD CONSTRAINT "platform_revenue_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_revenue" ADD CONSTRAINT "platform_revenue_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "organizations_api_key_idx" ON "organizations" USING btree ("api_key");--> statement-breakpoint
CREATE INDEX "organizations_is_active_idx" ON "organizations" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "payments_subscription_id_idx" ON "payments" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payments_tx_signature_idx" ON "payments" USING btree ("tx_signature");--> statement-breakpoint
CREATE INDEX "payments_created_at_idx" ON "payments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "payments_sub_status_idx" ON "payments" USING btree ("subscription_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_active_subscription" ON "subscriptions" USING btree ("plan_id","user_wallet","status");--> statement-breakpoint
CREATE INDEX "subscriptions_user_wallet_idx" ON "subscriptions" USING btree ("user_wallet");--> statement-breakpoint
CREATE INDEX "subscriptions_plan_id_idx" ON "subscriptions" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "subscriptions_status_idx" ON "subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "subscriptions_next_billing_date_idx" ON "subscriptions" USING btree ("next_billing_date");--> statement-breakpoint
CREATE INDEX "subscriptions_status_date_idx" ON "subscriptions" USING btree ("status","next_billing_date");--> statement-breakpoint
CREATE INDEX "webhooks_organization_id_idx" ON "webhooks" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "webhooks_status_idx" ON "webhooks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "webhooks_event_type_idx" ON "webhooks" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "webhooks_created_at_idx" ON "webhooks" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "activity_logs_team_id_idx" ON "activity_logs" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "activity_logs_user_id_idx" ON "activity_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "activity_logs_timestamp_idx" ON "activity_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "activity_logs_action_idx" ON "activity_logs" USING btree ("action");
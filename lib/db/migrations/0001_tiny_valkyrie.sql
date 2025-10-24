CREATE TABLE "subscription_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"amount" numeric(20, 0) NOT NULL,
	"platform_fee" numeric(20, 0) NOT NULL,
	"total_amount" numeric(20, 0) NOT NULL,
	"tx_signature" varchar(128),
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"delivery_method" varchar(100),
	"retry_count" integer DEFAULT 0,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_payments_tx_signature_unique" UNIQUE("tx_signature")
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"token_mint" varchar(44) NOT NULL,
	"amount_per_billing" numeric(20, 0) NOT NULL,
	"billing_period_days" integer NOT NULL,
	"token_decimals" integer DEFAULT 6 NOT NULL,
	"merchant_token_account" varchar(44) NOT NULL,
	"max_payments" integer,
	"monthly_spending_cap" numeric(20, 0),
	"image_url" text,
	"metadata" jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_wallet" varchar(44) NOT NULL,
	"user_email" varchar(255),
	"user_token_account" varchar(44) NOT NULL,
	"delegate_authority" varchar(44) NOT NULL,
	"approval_tx_signature" varchar(128),
	"delegation_verified" boolean DEFAULT false,
	"amount" numeric(20, 0) NOT NULL,
	"platform_fee" numeric(20, 0) NOT NULL,
	"total_amount" numeric(20, 0) NOT NULL,
	"next_billing_date" timestamp NOT NULL,
	"last_billing_date" timestamp,
	"status" varchar(50) DEFAULT 'pending_approval' NOT NULL,
	"total_payments" integer DEFAULT 0,
	"failed_payments" integer DEFAULT 0,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"cancelled_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD CONSTRAINT "subscription_plans_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sub_payments_subscription_idx" ON "subscription_payments" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "sub_payments_status_idx" ON "subscription_payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sub_payments_tx_idx" ON "subscription_payments" USING btree ("tx_signature");--> statement-breakpoint
CREATE INDEX "sub_plans_org_idx" ON "subscription_plans" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "sub_plans_active_idx" ON "subscription_plans" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "subscriptions_user_idx" ON "subscriptions" USING btree ("user_wallet");--> statement-breakpoint
CREATE INDEX "subscriptions_plan_idx" ON "subscriptions" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "subscriptions_status_idx" ON "subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "subscriptions_next_billing_idx" ON "subscriptions" USING btree ("next_billing_date");--> statement-breakpoint
CREATE INDEX "unique_active_sub" ON "subscriptions" USING btree ("plan_id","user_wallet","status") WHERE status IN ('active', 'pending_approval');
CREATE TABLE "download_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"token" varchar(128) NOT NULL,
	"customer_wallet" varchar(44) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"is_used" boolean DEFAULT false,
	"used_at" timestamp,
	"ip_address" varchar(45),
	"user_agent" text,
	CONSTRAINT "download_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"payment_id" uuid,
	"organization_id" uuid NOT NULL,
	"customer_wallet" varchar(44) NOT NULL,
	"customer_email" varchar(255),
	"price_paid" numeric(20, 0) NOT NULL,
	"tx_signature" varchar(128) NOT NULL,
	"download_count" integer DEFAULT 0,
	"max_downloads" integer NOT NULL,
	"last_download_at" timestamp,
	"status" varchar(50) DEFAULT 'completed' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "product_type" varchar(50) DEFAULT 'digital' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "file_size" bigint;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "file_type" varchar(100);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "download_limit" integer DEFAULT 5;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "link_expiry_hours" integer DEFAULT 24;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "preview_url" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "supabase_file_id" varchar(255);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "supabase_bucket" varchar(255) DEFAULT 'digital-products';--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "tags" jsonb;--> statement-breakpoint
ALTER TABLE "download_links" ADD CONSTRAINT "download_links_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_links" ADD CONSTRAINT "download_links_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_session_id_payment_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."payment_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "download_links_token_idx" ON "download_links" USING btree ("token");--> statement-breakpoint
CREATE INDEX "download_links_customer_idx" ON "download_links" USING btree ("customer_wallet");--> statement-breakpoint
CREATE INDEX "download_links_expires_idx" ON "download_links" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "purchases_product_idx" ON "purchases" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "purchases_customer_idx" ON "purchases" USING btree ("customer_wallet");--> statement-breakpoint
CREATE INDEX "purchases_tx_idx" ON "purchases" USING btree ("tx_signature");--> statement-breakpoint
CREATE INDEX "products_type_idx" ON "products" USING btree ("product_type");
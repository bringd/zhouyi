ALTER TABLE "users" ADD COLUMN "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "visit_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "user_agent" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "accept_language" varchar(50) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "first_referer" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_referer" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ip_address" varchar(45) DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_last_seen_idx" ON "users" USING btree ("last_seen_at");
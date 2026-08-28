ALTER TABLE "admins" ADD COLUMN "totp_secret" text;--> statement-breakpoint
ALTER TABLE "admins" ADD COLUMN "totp_enabled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "admins" ADD COLUMN "recovery_code_hashes" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "volunteers" ADD COLUMN "reset_code_hash" text;--> statement-breakpoint
ALTER TABLE "volunteers" ADD COLUMN "reset_expires_at" timestamp with time zone;
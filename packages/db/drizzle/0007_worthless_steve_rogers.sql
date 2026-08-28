ALTER TABLE "conversations" ADD COLUMN "seeker_name_ciphertext" text;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "seeker_name_iv" text;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "seeker_name_auth_tag" text;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "seeker_name_algorithm" text;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "seeker_name_key_id" text;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "seeker_name_cipher_version" smallint;
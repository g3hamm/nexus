CREATE TABLE "enablement_cache" (
	"conversation_id" uuid PRIMARY KEY NOT NULL,
	"full_ciphertext" text,
	"full_iv" text,
	"full_auth_tag" text,
	"full_algorithm" text,
	"full_key_id" text,
	"full_cipher_version" smallint,
	"full_generated_at" timestamp with time zone,
	"full_message_count" integer,
	"verses_ciphertext" text,
	"verses_iv" text,
	"verses_auth_tag" text,
	"verses_algorithm" text,
	"verses_key_id" text,
	"verses_cipher_version" smallint,
	"verses_generated_at" timestamp with time zone,
	"verses_message_count" integer
);
--> statement-breakpoint
ALTER TABLE "enablement_cache" ADD CONSTRAINT "enablement_cache_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
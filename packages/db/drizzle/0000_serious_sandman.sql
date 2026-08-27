CREATE TYPE "public"."conversation_status" AS ENUM('waiting', 'active', 'ended', 'under_review', 'terminated');--> statement-breakpoint
CREATE TYPE "public"."flag_status" AS ENUM('open', 'reviewing', 'upheld', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."modality" AS ENUM('text', 'audio', 'video');--> statement-breakpoint
CREATE TYPE "public"."participant_role" AS ENUM('seeker', 'volunteer', 'admin', 'system');--> statement-breakpoint
CREATE TYPE "public"."volunteer_status" AS ENUM('available', 'in_conversation', 'away', 'offline');--> statement-breakpoint
CREATE TABLE "admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" text NOT NULL,
	"actor_role" "participant_role" NOT NULL,
	"actor_id" text,
	"conversation_id" uuid,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seeker_id" text NOT NULL,
	"volunteer_id" uuid,
	"status" "conversation_status" DEFAULT 'waiting' NOT NULL,
	"room_id" text NOT NULL,
	"modality" "modality" DEFAULT 'text' NOT NULL,
	"seeker_language" text NOT NULL,
	"volunteer_language" text,
	"translation_required" boolean DEFAULT true NOT NULL,
	"wrapped_key" text NOT NULL,
	"key_id" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"matched_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"retain_until" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "knowledge_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"text" text NOT NULL,
	"language" text NOT NULL,
	"ordinal" integer NOT NULL,
	"embedding" vector(1024)
);
--> statement-breakpoint
CREATE TABLE "knowledge_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"kind" text NOT NULL,
	"language" text NOT NULL,
	"source" text NOT NULL,
	"doctrine_profiles" text[] DEFAULT '{}' NOT NULL,
	"body" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"author_role" "participant_role" NOT NULL,
	"author_id" text,
	"original_language" text NOT NULL,
	"ciphertext" text NOT NULL,
	"iv" text NOT NULL,
	"auth_tag" text NOT NULL,
	"algorithm" text NOT NULL,
	"key_id" text NOT NULL,
	"cipher_version" smallint DEFAULT 1 NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"flagged" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moderation_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"category" text,
	"severity" text NOT NULL,
	"subject" text NOT NULL,
	"rationale_ciphertext" text NOT NULL,
	"rationale_iv" text NOT NULL,
	"rationale_auth_tag" text NOT NULL,
	"rationale_algorithm" text NOT NULL,
	"rationale_key_id" text NOT NULL,
	"rationale_cipher_version" smallint DEFAULT 1 NOT NULL,
	"action" text NOT NULL,
	"evidence_message_ids" text[] NOT NULL,
	"confidence" real NOT NULL,
	"status" "flag_status" DEFAULT 'open' NOT NULL,
	"raised_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_note" text
);
--> statement-breakpoint
CREATE TABLE "volunteers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"languages" text[] NOT NULL,
	"status" "volunteer_status" DEFAULT 'offline' NOT NULL,
	"max_concurrent_conversations" integer DEFAULT 1 NOT NULL,
	"approved_at" timestamp with time zone,
	"suspended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_volunteer_id_volunteers_id_fk" FOREIGN KEY ("volunteer_id") REFERENCES "public"."volunteers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_document_id_knowledge_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."knowledge_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_flags" ADD CONSTRAINT "moderation_flags_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_flags" ADD CONSTRAINT "moderation_flags_reviewed_by_admins_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admins_email_idx" ON "admins" USING btree ("email");--> statement-breakpoint
CREATE INDEX "audit_conversation_idx" ON "audit_log" USING btree ("conversation_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_actor_idx" ON "audit_log" USING btree ("actor_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_action_idx" ON "audit_log" USING btree ("action","occurred_at");--> statement-breakpoint
CREATE INDEX "conversations_waiting_idx" ON "conversations" USING btree ("status","started_at");--> statement-breakpoint
CREATE INDEX "conversations_volunteer_idx" ON "conversations" USING btree ("volunteer_id","status");--> statement-breakpoint
CREATE INDEX "conversations_retention_idx" ON "conversations" USING btree ("retain_until");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_document_idx" ON "knowledge_chunks" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_embedding_idx" ON "knowledge_chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "knowledge_documents_kind_idx" ON "knowledge_documents" USING btree ("kind","language");--> statement-breakpoint
CREATE INDEX "messages_conversation_idx" ON "messages" USING btree ("conversation_id","sent_at");--> statement-breakpoint
CREATE INDEX "messages_flagged_idx" ON "messages" USING btree ("flagged");--> statement-breakpoint
CREATE INDEX "flags_status_idx" ON "moderation_flags" USING btree ("status","raised_at");--> statement-breakpoint
CREATE INDEX "flags_conversation_idx" ON "moderation_flags" USING btree ("conversation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "volunteers_email_idx" ON "volunteers" USING btree ("email");--> statement-breakpoint
CREATE INDEX "volunteers_status_idx" ON "volunteers" USING btree ("status");
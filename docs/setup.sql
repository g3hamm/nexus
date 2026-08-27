-- ───────────────────────────────────────────────────────────────────────
-- Nexus — one-time database setup
--
-- Paste this whole file into the Neon SQL Editor and press Run.
-- It is safe to run more than once: everything below is guarded, so a
-- second run changes nothing rather than failing.
--
-- GENERATED FILE — do not edit by hand. Regenerate with: pnpm db:sql
-- ───────────────────────────────────────────────────────────────────────

-- pgvector powers similarity search in the knowledge base. It has to exist
-- before the tables that use it, and drizzle-kit does not emit this line.
CREATE EXTENSION IF NOT EXISTS vector;

-- ── Migration 0000_serious_sandman ───────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "public"."conversation_status" AS ENUM('waiting', 'active', 'ended', 'under_review', 'terminated');
EXCEPTION WHEN duplicate_object OR duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."flag_status" AS ENUM('open', 'reviewing', 'upheld', 'dismissed');
EXCEPTION WHEN duplicate_object OR duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."modality" AS ENUM('text', 'audio', 'video');
EXCEPTION WHEN duplicate_object OR duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."participant_role" AS ENUM('seeker', 'volunteer', 'admin', 'system');
EXCEPTION WHEN duplicate_object OR duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."volunteer_status" AS ENUM('available', 'in_conversation', 'away', 'offline');
EXCEPTION WHEN duplicate_object OR duplicate_column THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" text NOT NULL,
	"actor_role" "participant_role" NOT NULL,
	"actor_id" text,
	"conversation_id" uuid,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "conversations" (
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

CREATE TABLE IF NOT EXISTS "knowledge_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"text" text NOT NULL,
	"language" text NOT NULL,
	"ordinal" integer NOT NULL,
	"embedding" vector(1024)
);

CREATE TABLE IF NOT EXISTS "knowledge_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"kind" text NOT NULL,
	"language" text NOT NULL,
	"source" text NOT NULL,
	"doctrine_profiles" text[] DEFAULT '{}' NOT NULL,
	"body" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "messages" (
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

CREATE TABLE IF NOT EXISTS "moderation_flags" (
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

CREATE TABLE IF NOT EXISTS "volunteers" (
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

DO $$ BEGIN
  ALTER TABLE "conversations" ADD CONSTRAINT "conversations_volunteer_id_volunteers_id_fk" FOREIGN KEY ("volunteer_id") REFERENCES "public"."volunteers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_document_id_knowledge_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."knowledge_documents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "moderation_flags" ADD CONSTRAINT "moderation_flags_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "moderation_flags" ADD CONSTRAINT "moderation_flags_reviewed_by_admins_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_column THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "admins_email_idx" ON "admins" USING btree ("email");

CREATE INDEX IF NOT EXISTS "audit_conversation_idx" ON "audit_log" USING btree ("conversation_id","occurred_at");

CREATE INDEX IF NOT EXISTS "audit_actor_idx" ON "audit_log" USING btree ("actor_id","occurred_at");

CREATE INDEX IF NOT EXISTS "audit_action_idx" ON "audit_log" USING btree ("action","occurred_at");

CREATE INDEX IF NOT EXISTS "conversations_waiting_idx" ON "conversations" USING btree ("status","started_at");

CREATE INDEX IF NOT EXISTS "conversations_volunteer_idx" ON "conversations" USING btree ("volunteer_id","status");

CREATE INDEX IF NOT EXISTS "conversations_retention_idx" ON "conversations" USING btree ("retain_until");

CREATE INDEX IF NOT EXISTS "knowledge_chunks_document_idx" ON "knowledge_chunks" USING btree ("document_id");

CREATE INDEX IF NOT EXISTS "knowledge_chunks_embedding_idx" ON "knowledge_chunks" USING hnsw ("embedding" vector_cosine_ops);

CREATE INDEX IF NOT EXISTS "knowledge_documents_kind_idx" ON "knowledge_documents" USING btree ("kind","language");

CREATE INDEX IF NOT EXISTS "messages_conversation_idx" ON "messages" USING btree ("conversation_id","sent_at");

CREATE INDEX IF NOT EXISTS "messages_flagged_idx" ON "messages" USING btree ("flagged");

CREATE INDEX IF NOT EXISTS "flags_status_idx" ON "moderation_flags" USING btree ("status","raised_at");

CREATE INDEX IF NOT EXISTS "flags_conversation_idx" ON "moderation_flags" USING btree ("conversation_id");

CREATE UNIQUE INDEX IF NOT EXISTS "volunteers_email_idx" ON "volunteers" USING btree ("email");

CREATE INDEX IF NOT EXISTS "volunteers_status_idx" ON "volunteers" USING btree ("status");

-- Record this migration as applied, so a later `pnpm db:migrate` skips
-- it rather than failing on tables that already exist.
CREATE SCHEMA IF NOT EXISTS drizzle;
CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
  id SERIAL PRIMARY KEY,
  hash text NOT NULL,
  created_at bigint
);

INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT 'eed9800664087e75ca814d33356c971391dc317c47e0ae092781f389c02273ed', 1787793438615
WHERE NOT EXISTS (
  SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = 'eed9800664087e75ca814d33356c971391dc317c47e0ae092781f389c02273ed'
);

-- ── Migration 0001_good_hairball ───────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE "conversations" ADD COLUMN "last_moderated_at" timestamp with time zone;
EXCEPTION WHEN duplicate_object OR duplicate_column THEN NULL;
END $$;

-- Record this migration as applied, so a later `pnpm db:migrate` skips
-- it rather than failing on tables that already exist.
CREATE SCHEMA IF NOT EXISTS drizzle;
CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
  id SERIAL PRIMARY KEY,
  hash text NOT NULL,
  created_at bigint
);

INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT '437b5c18485060722880e70b11502e1383858b5633bd957cb7ec59e0eca5ecde', 1787856206487
WHERE NOT EXISTS (
  SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = '437b5c18485060722880e70b11502e1383858b5633bd957cb7ec59e0eca5ecde'
);

-- ── Migration 0002_quick_the_order ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "volunteers" ADD COLUMN "application_note" text;
EXCEPTION WHEN duplicate_object OR duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "rate_limits_window_idx" ON "rate_limits" USING btree ("window_start");

-- Record this migration as applied, so a later `pnpm db:migrate` skips
-- it rather than failing on tables that already exist.
CREATE SCHEMA IF NOT EXISTS drizzle;
CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
  id SERIAL PRIMARY KEY,
  hash text NOT NULL,
  created_at bigint
);

INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT 'faf11bcf6142e05d4349029f694bc0302d74b6ea688b9e536fbbd68b36b9c4d5', 1787874063030
WHERE NOT EXISTS (
  SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = 'faf11bcf6142e05d4349029f694bc0302d74b6ea688b9e536fbbd68b36b9c4d5'
);

-- ── Done ───────────────────────────────────────────────────────────────
-- You should see eight tables under 'public' in the Neon Tables view.

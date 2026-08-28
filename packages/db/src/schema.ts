import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

/**
 * Nexus schema.
 *
 * Two things about this schema are unusual and deliberate.
 *
 * There is no `seekers` table. A seeker is a random handle on a conversation
 * row and nothing else — no account, no profile, no history that links two
 * visits together. Someone in a country where this conversation is dangerous
 * should not be accumulating a record of it in our database.
 *
 * Message content is stored as ciphertext, not text. The plaintext columns you
 * would expect (`body`, `translation`) do not exist. Repositories encrypt on
 * the way in and decrypt on the way out, so no query can accidentally return
 * readable transcript data.
 */

// ── Enums ───────────────────────────────────────────────────────────────────

export const participantRole = pgEnum("participant_role", [
  "seeker",
  "volunteer",
  "admin",
  "system",
]);

export const volunteerStatus = pgEnum("volunteer_status", [
  "available",
  "in_conversation",
  "away",
  "offline",
]);

export const conversationStatus = pgEnum("conversation_status", [
  "waiting",
  "active",
  "ended",
  "under_review",
  "terminated",
]);

export const modality = pgEnum("modality", ["text", "audio", "video"]);

export const flagStatus = pgEnum("flag_status", [
  "open",
  "reviewing",
  "upheld",
  "dismissed",
]);

// ── Accounts ────────────────────────────────────────────────────────────────

export const volunteers = pgTable(
  "volunteers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    displayName: text("display_name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    /** BCP-47 tags, best first. */
    languages: text("languages").array().notNull(),
    status: volunteerStatus("status").notNull().default("offline"),
    maxConcurrentConversations: integer("max_concurrent_conversations")
      .notNull()
      .default(1),
    /** Null until an admin approves. Unapproved volunteers cannot be matched. */
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    /** What the applicant said about themselves. Read by whoever approves them. */
    applicationNote: text("application_note"),

    /**
     * A one-time password reset, issued by an administrator.
     *
     * There is no email provider wired into Nexus, so a self-service reset
     * link cannot be sent. An admin issues a code instead and passes it to the
     * person however they already communicate — which for a small, vetted
     * volunteer base is both workable and arguably safer than email.
     */
    resetCodeHash: text("reset_code_hash"),
    resetExpiresAt: timestamp("reset_expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("volunteers_email_idx").on(t.email),
    index("volunteers_status_idx").on(t.status),
  ],
);

export const admins = pgTable(
  "admins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    displayName: text("display_name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),

    /**
     * TOTP seed, encrypted at rest. A leaked database must not hand over both
     * the password hashes and the second factor meant to survive them.
     */
    totpSecret: text("totp_secret"),
    /** Null until a code has been verified. Enrolling is not enabling. */
    totpEnabledAt: timestamp("totp_enabled_at", { withTimezone: true }),
    /**
     * HMACs of unused recovery codes. Without these, enabling MFA is a way to
     * lock yourself out of every transcript on the platform permanently.
     */
    recoveryCodeHashes: text("recovery_code_hashes").array().notNull().default([]),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("admins_email_idx").on(t.email)],
);

// ── Conversations ───────────────────────────────────────────────────────────

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Random per-visit handle. Intentionally not a foreign key to anything. */
    seekerId: text("seeker_id").notNull(),
    volunteerId: uuid("volunteer_id").references(() => volunteers.id, {
      onDelete: "set null",
    }),
    status: conversationStatus("status").notNull().default("waiting"),
    roomId: text("room_id").notNull(),
    modality: modality("modality").notNull().default("text"),
    seekerLanguage: text("seeker_language").notNull(),
    volunteerLanguage: text("volunteer_language"),
    translationRequired: boolean("translation_required").notNull().default(true),

    /**
     * This conversation's data key, wrapped by the KMS master key. Useless on
     * its own — reading a message needs this row, the ciphertext, and the
     * ability to call the KMS.
     */
    wrappedKey: text("wrapped_key").notNull(),
    keyId: text("key_id").notNull(),

    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    matchedAt: timestamp("matched_at", { withTimezone: true }),
    /** When the judge last looked. Drives the review cadence. */
    lastModeratedAt: timestamp("last_moderated_at", { withTimezone: true }),
    /** When someone here was first judged to be at risk. Set once, never cleared. */
    crisisRaisedAt: timestamp("crisis_raised_at", { withTimezone: true }),
    /** Non-null makes this a volunteer's practice session, not a real one. */
    practiceScenario: text("practice_scenario"),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    /** Null means "retain indefinitely", which is what a flag sets. */
    retainUntil: timestamp("retain_until", { withTimezone: true }),
  },
  (t) => [
    // The matching queue: oldest waiting conversation first.
    index("conversations_waiting_idx").on(t.status, t.startedAt),
    index("conversations_volunteer_idx").on(t.volunteerId, t.status),
    index("conversations_retention_idx").on(t.retainUntil),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    authorRole: participantRole("author_role").notNull(),
    /** Volunteer or admin id. Null for seekers, who have no durable identity. */
    authorId: text("author_id"),
    originalLanguage: text("original_language").notNull(),

    /**
     * All renderings — original and translations — as one encrypted JSON blob.
     *
     * One blob rather than a column per language because the set of languages
     * is open-ended, and because it keeps the number of encrypt/decrypt
     * operations at one per message rather than one per rendering.
     */
    ciphertext: text("ciphertext").notNull(),
    iv: text("iv").notNull(),
    authTag: text("auth_tag").notNull(),
    algorithm: text("algorithm").notNull(),
    keyId: text("key_id").notNull(),
    cipherVersion: smallint("cipher_version").notNull().default(1),

    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
    flagged: boolean("flagged").notNull().default(false),
  },
  (t) => [
    index("messages_conversation_idx").on(t.conversationId, t.sentAt),
    index("messages_flagged_idx").on(t.flagged),
  ],
);

// ── Moderation ──────────────────────────────────────────────────────────────

export const moderationFlags = pgTable(
  "moderation_flags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    category: text("category"),
    severity: text("severity").notNull(),
    subject: text("subject").notNull(),

    /**
     * The judge's reasoning, encrypted — it quotes the conversation, so it is
     * exactly as sensitive as the transcript itself.
     */
    rationaleCiphertext: text("rationale_ciphertext").notNull(),
    rationaleIv: text("rationale_iv").notNull(),
    rationaleAuthTag: text("rationale_auth_tag").notNull(),
    rationaleAlgorithm: text("rationale_algorithm").notNull(),
    rationaleKeyId: text("rationale_key_id").notNull(),
    rationaleCipherVersion: smallint("rationale_cipher_version").notNull().default(1),

    action: text("action").notNull(),
    evidenceMessageIds: text("evidence_message_ids").array().notNull(),
    confidence: real("confidence").notNull(),
    status: flagStatus("status").notNull().default("open"),
    raisedAt: timestamp("raised_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedBy: uuid("reviewed_by").references(() => admins.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNote: text("review_note"),
  },
  (t) => [
    index("flags_status_idx").on(t.status, t.raisedAt),
    index("flags_conversation_idx").on(t.conversationId),
  ],
);

// ── Scripture ───────────────────────────────────────────────────────────────

/**
 * Bible text, self-hosted.
 *
 * In the database rather than a file in the repository, for the same reason
 * the knowledge base is: a full translation is several megabytes, and bundling
 * that into a serverless function to serve one verse is the wrong shape. What
 * matters for the guarantee in ADR 6 is that scripture lookup never depends on
 * a third party being up at request time — self-hosted satisfies that; the
 * text simply arrives by a loader instead of by `git clone`.
 *
 * Only public-domain translations belong here. NIV, ESV, NASB and their
 * equivalents in other languages are licensed individually, and several
 * translations circulating as "free" JSON files are not actually public
 * domain. `publicDomain` is recorded per translation so the loader can refuse
 * anything not explicitly marked.
 */
export const bibleTranslations = pgTable("bible_translations", {
  /** Short code used in references and the UI, e.g. "kjv". */
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  language: text("language").notNull(),
  publicDomain: boolean("public_domain").notNull().default(false),
  /** Attribution to display. Null for text with no attribution requirement. */
  copyright: text("copyright"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const bibleVerses = pgTable(
  "bible_verses",
  {
    translationId: text("translation_id")
      .notNull()
      .references(() => bibleTranslations.id, { onDelete: "cascade" }),
    /** OSIS identifier, so every language resolves to the same row. */
    book: text("book").notNull(),
    chapter: integer("chapter").notNull(),
    verse: integer("verse").notNull(),
    text: text("text").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.translationId, t.book, t.chapter, t.verse] }),
    // The lookup this table exists for: one passage, one translation.
    index("bible_verses_passage_idx").on(t.translationId, t.book, t.chapter),
  ],
);

// ── Rate limiting ───────────────────────────────────────────────────────────

/**
 * Fixed-window request counters.
 *
 * Lives in Postgres rather than Redis so there is no extra vendor for a
 * feature this small, and the whole check is one atomic upsert.
 *
 * `key` is never a raw IP address. It is an HMAC of the address under the
 * server secret, because storing the IPs of people asking about Jesus from
 * Iran would recreate, in a side table, exactly the record the rest of this
 * system goes out of its way not to keep. The hash is enough to count against
 * and useless to anyone who steals the table.
 *
 * Rows are transient and swept by the nightly purge.
 */
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").primaryKey(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [index("rate_limits_window_idx").on(t.windowStart)],
);

// ── Audit ───────────────────────────────────────────────────────────────────

/**
 * Append-only. Every admin read of a transcript lands here, which is the only
 * thing that makes "admins can audit conversations" safe to offer.
 *
 * `detail` must never carry message content — it holds ids and counts.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    action: text("action").notNull(),
    actorRole: participantRole("actor_role").notNull(),
    actorId: text("actor_id"),
    conversationId: uuid("conversation_id"),
    detail: jsonb("detail").notNull().default({}),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_conversation_idx").on(t.conversationId, t.occurredAt),
    index("audit_actor_idx").on(t.actorId, t.occurredAt),
    index("audit_action_idx").on(t.action, t.occurredAt),
  ],
);

// ── Knowledge base ──────────────────────────────────────────────────────────

/**
 * Embedding width.
 *
 * 1024 matches Voyage AI's voyage-3 family, which is what Anthropic points at
 * for embeddings (the Claude API has no embeddings endpoint of its own).
 * Changing this is a migration, not a config change — pgvector fixes the
 * column width — so it is stated here as the single source of truth.
 */
export const EMBEDDING_DIMENSIONS = 1024;

export const knowledgeDocuments = pgTable(
  "knowledge_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    kind: text("kind").notNull(),
    language: text("language").notNull(),
    source: text("source").notNull(),
    /** Empty means the document is valid under every doctrine profile. */
    doctrineProfiles: text("doctrine_profiles").array().notNull().default([]),
    body: text("body").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("knowledge_documents_kind_idx").on(t.kind, t.language)],
);

export const knowledgeChunks = pgTable(
  "knowledge_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => knowledgeDocuments.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    language: text("language").notNull(),
    ordinal: integer("ordinal").notNull(),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
  },
  (t) => [
    index("knowledge_chunks_document_idx").on(t.documentId),
    // HNSW over cosine distance: the right index for "find the nearest few".
    index("knowledge_chunks_embedding_idx").using(
      "hnsw",
      t.embedding.op("vector_cosine_ops"),
    ),
  ],
);

export const schema = {
  volunteers,
  rateLimits,
  bibleTranslations,
  bibleVerses,
  admins,
  conversations,
  messages,
  moderationFlags,
  auditLog,
  knowledgeDocuments,
  knowledgeChunks,
};

import "server-only";

import type {
  AdminRepository,
  AlertChannel,
  AuditLog,
  BibleProvider,
  ConversationCrypto,
  ConversationRepository,
  EnablementEngine,
  FlagRepository,
  Judge,
  KnowledgeBase,
  LlmProvider,
  MessageRepository,
  ModerationScheduler,
  PracticePartner,
  RateLimiter,
  RealtimeTransport,
  Translator,
  VolunteerRepository,
} from "@nexus/core";
import { SessionSigner } from "@nexus/auth";
import { createConversationCrypto } from "@nexus/crypto";
import {
  createDatabase,
  DrizzleAdminRepository,
  DrizzleAuditLog,
  DrizzleConversationRepository,
  DrizzleFlagRepository,
  DrizzleMessageRepository,
  DrizzleVolunteerRepository,
  InMemoryRateLimiter,
  PostgresRateLimiter,
  type NexusDatabase,
} from "@nexus/db";
import { createLlmProvider } from "@nexus/llm";
import { createAlertChannel } from "@nexus/alerts";
import { LlmPracticePartner } from "@nexus/practice";
import { createRealtimeTransport } from "@nexus/realtime";
import { LlmTranslator } from "@nexus/translation";
import { LlmEnablementEngine } from "@nexus/enablement";
import { PgVectorKnowledgeBase, createEmbeddingProvider } from "@nexus/knowledge";
import { CadenceModerationScheduler, LlmJudge } from "@nexus/moderation";
import {
  ApiBibleProvider,
  CompositeBibleProvider,
  DatabaseBibleProvider,
} from "@nexus/bible";
import { env, isProduction } from "./env";

/**
 * The composition root.
 *
 * This is the only file in the app that knows which concrete implementation
 * backs each port. Swapping the LLM, the realtime transport, or the key
 * manager is an edit here and nowhere else — that is what "modular" has to
 * mean to survive being handed to another team.
 *
 * Everything is lazy and memoised. Serverless functions pay for construction
 * on cold start, and there is no reason for a request that only reads the
 * volunteer queue to have built a translator.
 */
export interface Container {
  readonly db: NexusDatabase;
  readonly crypto: ConversationCrypto;
  readonly conversations: ConversationRepository;
  readonly messages: MessageRepository;
  readonly volunteers: VolunteerRepository;
  readonly admins: AdminRepository;
  readonly flags: FlagRepository;
  readonly audit: AuditLog;
  readonly llm: LlmProvider;
  readonly translator: Translator;
  readonly realtime: RealtimeTransport;
  readonly sessions: SessionSigner;
  readonly rateLimiter: RateLimiter;
  readonly judge: Judge;
  readonly moderationScheduler: ModerationScheduler;
  /** Reaches a human outside the app. Only ever used for risk to life. */
  readonly alerts: AlertChannel;
  /** This deployment's public origin, or null when it does not know it. */
  readonly publicUrl: string | null;
  /** Whether alerts actually leave the building. Governs what we tell people. */
  readonly alertsDeliver: boolean;
  /** The difficult simulated seeker, and the coach afterwards. */
  readonly practice: PracticePartner;
  /** Wave two. Constructed here so the wiring point is already obvious. */
  readonly enablement: EnablementEngine;
  readonly knowledge: KnowledgeBase;
  readonly bible: BibleProvider;
}

let instance: Container | null = null;

export function container(): Container {
  if (instance) return instance;

  const config = env();

  const db = createDatabase(config.DATABASE_URL);

  const crypto = createConversationCrypto({
    provider: config.NEXUS_KMS_PROVIDER,
    masterKeyBase64: config.NEXUS_MASTER_KEY,
    awsKeyId: config.AWS_KMS_KEY_ID,
    awsRegion: config.AWS_REGION,
    isProduction: isProduction(),
    allowInsecureLocalKeyInProduction: config.NEXUS_ALLOW_INSECURE_LOCAL_KMS,
  });

  const llm = createLlmProvider({
    provider: config.NEXUS_LLM_PROVIDER,
    anthropicApiKey: config.ANTHROPIC_API_KEY,
    isProduction: isProduction(),
  });

  const embeddings = createEmbeddingProvider({
    provider: config.NEXUS_EMBEDDING_PROVIDER,
    voyageApiKey: config.VOYAGE_API_KEY,
    isProduction: isProduction(),
  });

  const knowledge = new PgVectorKnowledgeBase(db, embeddings);

  // Widest coverage first, our own copy last. API.Bible reaches languages no
  // public-domain text covers; the database is the floor that cannot go down.
  const bible = new CompositeBibleProvider([
    ...(config.API_BIBLE_KEY ? [new ApiBibleProvider(config.API_BIBLE_KEY)] : []),
    new DatabaseBibleProvider(db),
  ]);

  const realtime = createRealtimeTransport({
    provider: config.NEXUS_REALTIME_PROVIDER,
    url: config.LIVEKIT_URL,
    apiKey: config.LIVEKIT_API_KEY,
    apiSecret: config.LIVEKIT_API_SECRET,
    isProduction: isProduction(),
  });

  instance = {
    db,
    crypto,
    conversations: new DrizzleConversationRepository(db, crypto),
    messages: new DrizzleMessageRepository(db, crypto),
    volunteers: new DrizzleVolunteerRepository(db),
    admins: new DrizzleAdminRepository(db),
    flags: new DrizzleFlagRepository(db, crypto),
    audit: new DrizzleAuditLog(db),
    llm,
    translator: new LlmTranslator(llm),
    realtime,
    sessions: new SessionSigner(config.NEXUS_SESSION_SECRET),
    // Keyed on an HMAC of the caller's address under the session secret, so
    // the counter table never holds a recoverable IP. See PostgresRateLimiter.
    rateLimiter: isProduction()
      ? new PostgresRateLimiter(db, config.NEXUS_SESSION_SECRET)
      : new InMemoryRateLimiter(),
    judge: new LlmJudge(llm),
    moderationScheduler: new CadenceModerationScheduler(),
    alerts: createAlertChannel({ webhookUrl: config.NEXUS_ALERT_WEBHOOK_URL }),
    publicUrl: publicUrl(config.NEXUS_PUBLIC_URL),
    alertsDeliver: Boolean(config.NEXUS_ALERT_WEBHOOK_URL?.trim()),
    practice: new LlmPracticePartner(llm),
    enablement: new LlmEnablementEngine(llm, knowledge),
    knowledge,
    bible,
  };

  return instance;
}

/**
 * The origin to put in an alert link, or null.
 *
 * Falls back to Vercel's production domain, never to the per-deployment one:
 * a preview URL in an alert sends whoever clicks it to a build that may not
 * exist by the time they do.
 */
function publicUrl(configured: string | undefined): string | null {
  const explicit = configured?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  return vercel ? `https://${vercel}` : null;
}

/** Tests replace the container wholesale rather than reaching into it. */
export function setContainerForTesting(replacement: Container | null): void {
  instance = replacement;
}

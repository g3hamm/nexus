import "server-only";

import type {
  AdminRepository,
  AlertChannel,
  AuditLog,
  BibleProvider,
  ConversationCrypto,
  ConversationRepository,
  EnablementCacheRepository,
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
  DrizzleEnablementCacheRepository,
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
  BundledBibleProvider,
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
  readonly enablementCache: EnablementCacheRepository;
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

/**
 * Builds once, on first use, and never again.
 *
 * This is what makes the laziness above real rather than aspirational. It was
 * aspirational for a while, and the bill came due on a deploy: the container
 * constructed every subsystem eagerly, so a knowledge base that refused to
 * start took down the volunteer sign-in page — a page that has no knowledge
 * base, no LLM, and no realtime transport anywhere near it. Signing in should
 * not be able to fail because of how retrieval is configured.
 */
function memo<T>(build: () => T): () => T {
  let value: T;
  let built = false;
  return () => {
    if (!built) {
      value = build();
      built = true;
    }
    return value;
  };
}

export function container(): Container {
  if (instance) return instance;

  const config = env();
  const production = isProduction();

  const db = memo(() => createDatabase(config.DATABASE_URL));

  const crypto = memo(() =>
    createConversationCrypto({
      provider: config.NEXUS_KMS_PROVIDER,
      masterKeyBase64: config.NEXUS_MASTER_KEY,
      awsKeyId: config.AWS_KMS_KEY_ID,
      awsRegion: config.AWS_REGION,
      isProduction: production,
      allowInsecureLocalKeyInProduction: config.NEXUS_ALLOW_INSECURE_LOCAL_KMS,
    }),
  );

  const llm = memo(() =>
    createLlmProvider({
      provider: config.NEXUS_LLM_PROVIDER,
      anthropicApiKey: config.ANTHROPIC_API_KEY,
      isProduction: production,
    }),
  );

  const embeddings = memo(() =>
    createEmbeddingProvider({
      provider: config.NEXUS_EMBEDDING_PROVIDER,
      voyageApiKey: config.VOYAGE_API_KEY,
      isProduction: production,
      allowHashingInProduction: config.NEXUS_ALLOW_HASHING_EMBEDDINGS,
    }),
  );

  const knowledge = memo(() => new PgVectorKnowledgeBase(db(), embeddings()));

  // Widest coverage first, the shipped copy last.
  //
  // API.Bible reaches languages no public-domain text covers, and a ministry
  // may have loaded its own vetted translations into the database — both are
  // better answers for a seeker than English. Underneath them sits the World
  // English Bible, in this repository, needing no key and no load step: it is
  // the floor, and it is a floor precisely because nothing has to be done to
  // it before it holds.
  const bible = memo(
    () =>
      new CompositeBibleProvider([
        ...(config.API_BIBLE_KEY ? [new ApiBibleProvider(config.API_BIBLE_KEY)] : []),
        new DatabaseBibleProvider(db()),
        new BundledBibleProvider(),
      ]),
  );

  const realtime = memo(() =>
    createRealtimeTransport({
      provider: config.NEXUS_REALTIME_PROVIDER,
      url: config.LIVEKIT_URL,
      apiKey: config.LIVEKIT_API_KEY,
      apiSecret: config.LIVEKIT_API_SECRET,
      isProduction: production,
    }),
  );

  const conversations = memo(() => new DrizzleConversationRepository(db(), crypto()));
  const messages = memo(() => new DrizzleMessageRepository(db(), crypto()));
  const volunteers = memo(() => new DrizzleVolunteerRepository(db()));
  const admins = memo(() => new DrizzleAdminRepository(db()));
  const flags = memo(() => new DrizzleFlagRepository(db(), crypto()));
  const enablementCache = memo(
    () => new DrizzleEnablementCacheRepository(db(), crypto()),
  );
  const audit = memo(() => new DrizzleAuditLog(db()));
  const translator = memo(() => new LlmTranslator(llm()));
  const sessions = memo(() => new SessionSigner(config.NEXUS_SESSION_SECRET));
  const judge = memo(() => new LlmJudge(llm()));
  const scheduler = memo(() => new CadenceModerationScheduler());
  const alerts = memo(() =>
    createAlertChannel({ webhookUrl: config.NEXUS_ALERT_WEBHOOK_URL }),
  );
  const practice = memo(() => new LlmPracticePartner(llm()));
  const enablement = memo(() => new LlmEnablementEngine(llm(), knowledge()));

  // Keyed on an HMAC of the caller's address under the session secret, so the
  // counter table never holds a recoverable IP. See PostgresRateLimiter.
  const rateLimiter = memo(() =>
    production
      ? new PostgresRateLimiter(db(), config.NEXUS_SESSION_SECRET)
      : new InMemoryRateLimiter(),
  );

  instance = {
    get db() {
      return db();
    },
    get crypto() {
      return crypto();
    },
    get conversations() {
      return conversations();
    },
    get messages() {
      return messages();
    },
    get volunteers() {
      return volunteers();
    },
    get admins() {
      return admins();
    },
    get flags() {
      return flags();
    },
    get enablementCache() {
      return enablementCache();
    },
    get audit() {
      return audit();
    },
    get llm() {
      return llm();
    },
    get translator() {
      return translator();
    },
    get realtime() {
      return realtime();
    },
    get sessions() {
      return sessions();
    },
    get rateLimiter() {
      return rateLimiter();
    },
    get judge() {
      return judge();
    },
    get moderationScheduler() {
      return scheduler();
    },
    get alerts() {
      return alerts();
    },
    get practice() {
      return practice();
    },
    get enablement() {
      return enablement();
    },
    get knowledge() {
      return knowledge();
    },
    get bible() {
      return bible();
    },
    // Plain values. Neither can fail, so neither needs deferring.
    publicUrl: publicUrl(config.NEXUS_PUBLIC_URL),
    alertsDeliver: Boolean(config.NEXUS_ALERT_WEBHOOK_URL?.trim()),
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

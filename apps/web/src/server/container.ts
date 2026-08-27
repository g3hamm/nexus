import "server-only";

import type {
  AuditLog,
  ConversationCrypto,
  ConversationRepository,
  EnablementEngine,
  Judge,
  KnowledgeBase,
  LlmProvider,
  MessageRepository,
  RealtimeTransport,
  Translator,
  VolunteerRepository,
  BibleProvider,
} from "@nexus/core";
import { SessionSigner } from "@nexus/auth";
import { createConversationCrypto } from "@nexus/crypto";
import {
  createDatabase,
  DrizzleAuditLog,
  DrizzleConversationRepository,
  DrizzleMessageRepository,
  DrizzleVolunteerRepository,
  type NexusDatabase,
} from "@nexus/db";
import { createLlmProvider } from "@nexus/llm";
import { createRealtimeTransport } from "@nexus/realtime";
import { LlmTranslator } from "@nexus/translation";
import { LlmEnablementEngine } from "@nexus/enablement";
import { LlmJudge } from "@nexus/moderation";
import { PgVectorKnowledgeBase } from "@nexus/knowledge";
import { BundledBibleProvider } from "@nexus/bible";
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
  readonly audit: AuditLog;
  readonly llm: LlmProvider;
  readonly translator: Translator;
  readonly realtime: RealtimeTransport;
  readonly sessions: SessionSigner;
  /** Wave two. Constructed here so the wiring point is already obvious. */
  readonly enablement: EnablementEngine;
  readonly judge: Judge;
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
  });

  const llm = createLlmProvider({
    provider: config.NEXUS_LLM_PROVIDER,
    anthropicApiKey: config.ANTHROPIC_API_KEY,
    isProduction: isProduction(),
  });

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
    audit: new DrizzleAuditLog(db),
    llm,
    translator: new LlmTranslator(llm),
    realtime,
    sessions: new SessionSigner(config.NEXUS_SESSION_SECRET),
    enablement: new LlmEnablementEngine(),
    judge: new LlmJudge(),
    knowledge: new PgVectorKnowledgeBase(),
    bible: new BundledBibleProvider(),
  };

  return instance;
}

/** Tests replace the container wholesale rather than reaching into it. */
export function setContainerForTesting(replacement: Container | null): void {
  instance = replacement;
}

import { z } from "zod";
import type { ConversationId, MessageId } from "./ids.js";
import { languageCodeSchema, type LanguageCode } from "./language.js";
import { participantRoleSchema, type ParticipantRole } from "./participants.js";

/**
 * A rendering of a message in one language.
 *
 * The original is always kept verbatim alongside the translation. Two reasons:
 * an admin auditing a conversation must be able to see what was actually
 * said rather than a machine's opinion of it, and a volunteer double-checking
 * a tense moment needs the source text.
 */
export interface Rendering {
  readonly language: LanguageCode;
  readonly text: string;
  /** "original" when this is what the author typed. */
  readonly source: "original" | "machine";
  /** Engine that produced a machine rendering, for auditability. */
  readonly engine?: string;
  /** 0..1 self-reported confidence, when the engine provides one. */
  readonly confidence?: number;
}

export interface Message {
  readonly id: MessageId;
  readonly conversationId: ConversationId;
  readonly authorRole: ParticipantRole;
  /** Null for seekers, who have no durable identity. */
  readonly authorId: string | null;
  readonly originalLanguage: LanguageCode;
  /** Every rendering, including the original. Never empty. */
  readonly renderings: readonly Rendering[];
  readonly sentAt: Date;
  /** Set when a moderation flag references this message. */
  readonly flagged: boolean;
}

export const sendMessageSchema = z.object({
  conversationId: z.string().min(1),
  text: z.string().min(1).max(4000),
  language: languageCodeSchema.optional(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

/** The author's own words. Always present. */
export function original(message: Message): Rendering {
  const found = message.renderings.find((r) => r.source === "original");
  if (found) return found;
  const first = message.renderings[0];
  if (!first) {
    throw new Error(`Message ${message.id} has no renderings`);
  }
  return first;
}

/**
 * The rendering to show a reader in `language`, preferring an exact match,
 * then the same primary language, then the original.
 */
export function renderingFor(message: Message, language: LanguageCode): Rendering {
  const exact = message.renderings.find((r) => r.language === language);
  if (exact) return exact;

  const primary = language.split("-")[0]?.toLowerCase();
  const loose = message.renderings.find(
    (r) => r.language.split("-")[0]?.toLowerCase() === primary,
  );
  if (loose) return loose;

  return original(message);
}

export const messageAuthorSchema = participantRoleSchema;

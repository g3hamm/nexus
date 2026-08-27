import { z } from "zod";
import type { ConversationId, RoomId, SeekerId, VolunteerId } from "./ids.js";
import { languageCodeSchema, type LanguageCode } from "./language.js";

/**
 * How a conversation is being carried.
 *
 * Only "text" is implemented today. The field exists now so that adding voice
 * or video later is a new value and a new capability grant on the realtime
 * token — not a schema migration and a rewrite of the matching logic.
 */
export type Modality = "text" | "audio" | "video";

export const modalitySchema = z.enum(["text", "audio", "video"]);

export type ConversationStatus =
  /** Seeker is here, no volunteer yet. */
  | "waiting"
  /** Both parties present. */
  | "active"
  /** Ended normally by either party. */
  | "ended"
  /** Held open pending admin review after a moderation flag. */
  | "under_review"
  /** Ended by an admin. */
  | "terminated";

export const conversationStatusSchema = z.enum([
  "waiting",
  "active",
  "ended",
  "under_review",
  "terminated",
]);

export interface Conversation {
  readonly id: ConversationId;
  readonly seekerId: SeekerId;
  readonly volunteerId: VolunteerId | null;
  readonly status: ConversationStatus;
  /** Realtime room backing this conversation. Carries over unchanged to video. */
  readonly roomId: RoomId;
  readonly modality: Modality;
  readonly seekerLanguage: LanguageCode;
  readonly volunteerLanguage: LanguageCode | null;
  /** True when the two parties share a language and translation is a no-op. */
  readonly translationRequired: boolean;
  readonly startedAt: Date;
  readonly matchedAt: Date | null;
  readonly endedAt: Date | null;
  /**
   * When the transcript becomes eligible for purge. Null means "keep",
   * which is set on flagged conversations pending review.
   */
  readonly retainUntil: Date | null;
}

export const startConversationSchema = z.object({
  seekerLanguage: languageCodeSchema,
  modality: modalitySchema.default("text"),
  region: z.string().max(8).optional(),
});

export type StartConversationInput = z.infer<typeof startConversationSchema>;

export function isLive(c: Conversation): boolean {
  return c.status === "waiting" || c.status === "active";
}

export function canAcceptVolunteer(c: Conversation): boolean {
  return c.status === "waiting" && c.volunteerId === null;
}

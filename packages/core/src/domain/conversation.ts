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
  /** When the judge last reviewed this conversation. Null means never. */
  readonly lastModeratedAt: Date | null;
  /**
   * When the judge first judged someone here to be at risk of harm.
   *
   * Set once and never cleared. It is what makes the crisis card survive a
   * page reload, a dropped socket, and a device change — a seeker who closes
   * the tab and comes back should not have to say it twice to get the numbers
   * again. It is a timestamp, not a diagnosis, and nothing in the product
   * treats the person differently because of it.
   */
  readonly crisisRaisedAt: Date | null;
  /**
   * The practice scenario this conversation is an exercise in, or null.
   *
   * Non-null makes it a training session: a real conversation row on the real
   * surface, so the volunteer practises the product rather than a mock, but
   * one that never enters the seeker queue, is never reviewed by the judge,
   * and never pages anyone. See `isPractice`.
   */
  readonly practiceScenario: string | null;
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

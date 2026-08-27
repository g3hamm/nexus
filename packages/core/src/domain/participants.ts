import { z } from "zod";
import type { AdminId, SeekerId, VolunteerId } from "./ids.js";
import { languageCodeSchema, type LanguageCode } from "./language.js";

/**
 * Three roles, and the asymmetry between them is the product.
 *
 * A seeker has no account and leaves no identity behind. A volunteer has an
 * account and is accountable. An admin can audit, and every audit read is
 * itself recorded.
 */
export type ParticipantRole = "seeker" | "volunteer" | "admin" | "system";

export const participantRoleSchema = z.enum(["seeker", "volunteer", "admin", "system"]);

/**
 * A seeker is deliberately thin. No name, no email, no account row.
 *
 * The id is a random per-visit handle, not a stable identifier — the same
 * person returning tomorrow is a different seeker as far as Nexus knows.
 * This is a safety decision, not an oversight: in a number of countries the
 * existence of a durable record linking a person to this conversation is
 * itself the danger.
 */
export interface Seeker {
  readonly id: SeekerId;
  readonly language: LanguageCode;
  /** Best-effort, coarse (country-level at most), used only for volunteer routing. */
  readonly region?: string;
  readonly createdAt: Date;
}

export type VolunteerStatus = "available" | "in_conversation" | "away" | "offline";

export const volunteerStatusSchema = z.enum([
  "available",
  "in_conversation",
  "away",
  "offline",
]);

export interface Volunteer {
  readonly id: VolunteerId;
  readonly displayName: string;
  readonly email: string;
  /** Languages this volunteer can hold a conversation in, best first. */
  readonly languages: readonly LanguageCode[];
  readonly status: VolunteerStatus;
  /** How many conversations they will hold at once. Defaults to 1. */
  readonly maxConcurrentConversations: number;
  readonly approvedAt: Date | null;
  readonly suspendedAt: Date | null;
  /** What they said when applying. Shown to whoever decides on them. */
  readonly applicationNote: string | null;
  readonly createdAt: Date;
}

export interface Admin {
  readonly id: AdminId;
  readonly displayName: string;
  readonly email: string;
  readonly createdAt: Date;
}

export const volunteerProfileSchema = z.object({
  displayName: z.string().min(1).max(80),
  email: z.string().email(),
  languages: z.array(languageCodeSchema).min(1),
  maxConcurrentConversations: z.number().int().min(1).max(5).default(1),
});

export type VolunteerProfileInput = z.infer<typeof volunteerProfileSchema>;

export function isActiveVolunteer(v: Volunteer): boolean {
  return v.approvedAt !== null && v.suspendedAt === null;
}

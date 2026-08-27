import { z } from "zod";
import type { ConversationId, FlagId, MessageId } from "./ids.js";

/**
 * What the judge watches for.
 *
 * Note that this cuts both ways by design. A volunteer who becomes coercive,
 * solicits money, or pushes to move the conversation to a private channel is
 * as much a moderation concern as an abusive seeker — arguably more, because
 * the volunteer carries the platform's authority.
 */
export type ModerationCategory =
  | "sexual_content"
  | "harassment_or_hate"
  | "violence_or_threats"
  /** Seeker appears to be in crisis or at risk of self-harm. Escalates, never punishes. */
  | "self_harm_risk"
  /** Either party pushing to exchange contact details or move off-platform. */
  | "off_platform_contact"
  /** Requests for or offers of money, gifts, visas, sponsorship. */
  | "financial_solicitation"
  /** Pressure, manipulation, or threats framed as spiritual guidance. */
  | "spiritual_coercion"
  /** Personally identifying information being shared, which endangers seekers. */
  | "pii_disclosure"
  /** Volunteer materially misrepresenting Christian teaching. */
  | "doctrinal_misrepresentation"
  /** Conversation has drifted well away from the platform's purpose. */
  | "off_mission";

export const moderationCategorySchema = z.enum([
  "sexual_content",
  "harassment_or_hate",
  "violence_or_threats",
  "self_harm_risk",
  "off_platform_contact",
  "financial_solicitation",
  "spiritual_coercion",
  "pii_disclosure",
  "doctrinal_misrepresentation",
  "off_mission",
]);

export type ModerationSeverity = "none" | "low" | "medium" | "high" | "critical";

export const moderationSeveritySchema = z.enum([
  "none",
  "low",
  "medium",
  "high",
  "critical",
]);

/**
 * What the platform should do about it.
 *
 * Deliberately conservative: the judge advises, and only `terminate` and
 * `escalate_crisis` act without a human. Everything else queues for review.
 * An LLM should not be quietly ending conversations about faith because it
 * misread an idiom in a language it handles poorly.
 */
export type ModerationAction =
  | "none"
  | "monitor"
  | "flag_for_review"
  /** Surface a private nudge to the volunteer without interrupting the seeker. */
  | "coach_volunteer"
  /** Show crisis resources and alert an admin immediately. */
  | "escalate_crisis"
  | "terminate";

export const moderationActionSchema = z.enum([
  "none",
  "monitor",
  "flag_for_review",
  "coach_volunteer",
  "escalate_crisis",
  "terminate",
]);

export type FlagSubject = "seeker" | "volunteer" | "both" | "unclear";

export const flagSubjectSchema = z.enum(["seeker", "volunteer", "both", "unclear"]);

/** The judge's structured opinion about a window of conversation. */
export interface ModerationVerdict {
  readonly category: ModerationCategory | null;
  readonly severity: ModerationSeverity;
  readonly subject: FlagSubject;
  /** Plain-language reason, written for the admin who will read it. */
  readonly rationale: string;
  readonly action: ModerationAction;
  /** Messages the verdict rests on. */
  readonly evidenceMessageIds: readonly MessageId[];
  /** 0..1. Low confidence should bias toward review rather than action. */
  readonly confidence: number;
}

export const moderationVerdictSchema = z.object({
  category: moderationCategorySchema.nullable(),
  severity: moderationSeveritySchema,
  subject: flagSubjectSchema,
  rationale: z.string().min(1).max(2000),
  action: moderationActionSchema,
  evidenceMessageIds: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export type FlagStatus = "open" | "reviewing" | "upheld" | "dismissed";

export const flagStatusSchema = z.enum(["open", "reviewing", "upheld", "dismissed"]);

export interface ModerationFlag {
  readonly id: FlagId;
  readonly conversationId: ConversationId;
  readonly verdict: ModerationVerdict;
  readonly status: FlagStatus;
  readonly raisedAt: Date;
  readonly reviewedBy: string | null;
  readonly reviewedAt: Date | null;
  readonly reviewNote: string | null;
}

/** Severities at or above which a human must look, regardless of action. */
export function requiresHumanReview(v: ModerationVerdict): boolean {
  return (
    v.severity === "high" ||
    v.severity === "critical" ||
    v.action === "escalate_crisis" ||
    v.action === "terminate"
  );
}

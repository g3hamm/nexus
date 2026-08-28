import { z } from "zod";
import type { LanguageCode } from "./language.js";

/**
 * Practice scenarios for volunteers.
 *
 * The whole value of this depends on the simulated seeker being difficult.
 * A polite, curious, grateful practice partner teaches a volunteer that this
 * work is polite, curious and grateful, which is a lie that will cost a real
 * person somewhere. The people who show up are angry, articulate, frightened,
 * bored, testing, or in genuine danger, and several of them have better
 * arguments than the volunteer does.
 *
 * So scenarios are built to be combative in what they raise and divisive in
 * how they raise it, and the debrief afterwards is honest about how it went.
 */
export type PracticeDifficulty =
  /** Genuinely open, but carrying something heavy. Still not easy. */
  | "searching"
  /** Arguing. Informed, unimpressed, and not looking for comfort. */
  | "sceptical"
  /** Hostile, provocative, or in a state where nothing said will land well. */
  | "hostile";

export const practiceDifficultySchema = z.enum(["searching", "sceptical", "hostile"]);

export interface PracticeScenario {
  readonly id: string;
  /** Named for the volunteer choosing it. */
  readonly title: string;
  /**
   * What the volunteer is told before starting.
   *
   * Enough to know what they are walking into, never the whole person. The
   * discovery is most of the exercise, and a volunteer who has read the
   * backstory practises confirming it rather than listening.
   */
  readonly premise: string;
  readonly difficulty: PracticeDifficulty;
  /**
   * The language the simulated seeker writes in.
   *
   * Almost never English, on purpose. A volunteer who has only practised in
   * their own language has not practised this product: they have not felt the
   * translation delay, watched a reply arrive in a script they cannot read,
   * or learned that their idiom did not survive the trip.
   */
  readonly language: LanguageCode;
  /**
   * The persona handed to the model. Never shown to the volunteer.
   */
  readonly persona: string;
  /** What this scenario is actually testing. Drives the debrief. */
  readonly competencies: readonly string[];
  /**
   * True when the scenario is built to reach disclosure of self-harm.
   *
   * Flagged so the volunteer can be warned before they choose it, and so the
   * platform knows that a crisis card appearing here is the exercise working
   * rather than an emergency.
   */
  readonly reachesCrisis: boolean;
}

/** One line of a practice transcript, as the model sees it. */
export interface PracticeExchange {
  readonly role: "seeker" | "volunteer";
  readonly text: string;
}

export interface PracticeTurn {
  /** In the scenario's language. */
  readonly text: string;
  /**
   * The simulated seeker has said what they came to say.
   *
   * A practice partner that never lets go teaches a volunteer to keep
   * pushing, which is the opposite of the lesson.
   */
  readonly ends: boolean;
  /**
   * This turn discloses risk of self-harm.
   *
   * Drives the crisis card directly. Practice conversations are not reviewed
   * by the judge — see `isPractice` — so this is how a volunteer gets to see
   * the real thing happen, without a flag, an alert, or anyone being woken.
   */
  readonly disclosesRisk: boolean;
}

export const practiceTurnSchema = z.object({
  text: z.string().min(1).max(2000),
  ends: z.boolean(),
  disclosesRisk: z.boolean(),
});

export interface PracticeNote {
  readonly point: string;
  /**
   * What the volunteer actually wrote, quoted.
   *
   * Null when the note is about something absent. Feedback without the words
   * in front of you is a horoscope: everyone recognises themselves in "be
   * more curious" and nobody changes because of it.
   */
  readonly quote: string | null;
  readonly why: string;
}

export const practiceNoteSchema = z.object({
  point: z.string().min(1).max(400),
  quote: z.string().max(600).nullable(),
  why: z.string().min(1).max(600),
});

/**
 * How ready this volunteer looks, on this evidence.
 *
 * Deliberately three coarse bands rather than a score. A number invites
 * volunteers to optimise it and administrators to rank people by it, and
 * neither is what this is for.
 */
export type PracticeReadiness = "not_yet" | "with_support" | "ready";

export const practiceReadinessSchema = z.enum(["not_yet", "with_support", "ready"]);

export interface PracticeDebrief {
  readonly summary: string;
  readonly strengths: readonly PracticeNote[];
  readonly growth: readonly PracticeNote[];
  /**
   * Things that would have hurt a real person.
   *
   * Kept separate from `growth` because they are not the same kind of note
   * and softening them into one list is how they get skimmed past. Empty is
   * the goal, and empty is common.
   */
  readonly harms: readonly PracticeNote[];
  readonly missed: readonly PracticeNote[];
  readonly readiness: PracticeReadiness;
}

export const practiceDebriefSchema = z.object({
  summary: z.string().min(1).max(1500),
  strengths: z.array(practiceNoteSchema).max(6),
  growth: z.array(practiceNoteSchema).max(6),
  harms: z.array(practiceNoteSchema).max(6),
  missed: z.array(practiceNoteSchema).max(6),
  readiness: practiceReadinessSchema,
});

/**
 * Whether this conversation is an exercise.
 *
 * Practice conversations are real rows on the real surface — same
 * translation, same sidebar, same scripture lookups — because practising on
 * a mock teaches the mock. What they are not is real: they never enter the
 * seeker queue, they are never reviewed by the judge, and nothing about them
 * ever pages a human being. A volunteer rehearsing a suicide disclosure at
 * two in the morning must not wake a pastor.
 */
export function isPractice(conversation: { readonly practiceScenario: string | null }) {
  return conversation.practiceScenario !== null;
}

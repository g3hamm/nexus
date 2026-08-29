import type { AcademyModuleBrief } from "../domain/academy.js";
import type { LanguageCode } from "../domain/language.js";
import type {
  PracticeDebrief,
  PracticeExchange,
  PracticeScenario,
  PracticeTurn,
} from "../domain/practice.js";

/**
 * The other side of a practice conversation, and the coach afterwards.
 *
 * Two responsibilities in one port because they need the same thing — a
 * scenario and a transcript — and because splitting them would invite an
 * implementation where the partner and the assessor disagree about what the
 * exercise was for.
 */
export interface PracticePartner {
  /**
   * The simulated seeker's next message, in the scenario's language.
   *
   * Stays in character. A practice partner that softens when the volunteer
   * struggles is training them for a conversation that will not happen.
   */
  reply(
    scenario: PracticeScenario,
    exchanges: readonly PracticeExchange[],
  ): Promise<PracticeTurn>;

  /**
   * The debrief.
   *
   * Written to the volunteer, about specific things they said. It has to be
   * usable by someone who has just been told they did badly, which means
   * honest without being crushing — a volunteer who is discouraged out of the
   * ministry by a practice exercise is a worse outcome than one who needed
   * two more attempts.
   */
  debrief(
    scenario: PracticeScenario,
    exchanges: readonly PracticeExchange[],
    /** The volunteer's own language. Feedback is useless in a second language. */
    language: LanguageCode,
    /**
     * The Academy module this exercise was started from, when it was.
     *
     * Feedback that knows what somebody was trying to learn is worth a great
     * deal more than feedback that does not: "you did the thing that module
     * warned you about, here" is actionable in a way that a general note on
     * listening is not. Absent when the volunteer came from the practice list
     * rather than from a module, which is a normal way to arrive.
     */
    module?: AcademyModuleBrief,
  ): Promise<PracticeDebrief>;
}

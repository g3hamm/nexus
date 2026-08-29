/**
 * The Apologetics Academy: structured training for volunteers.
 *
 * This is deliberately a different thing from the knowledge base. The
 * knowledge base is retrieval — material a volunteer is handed mid-conversation
 * because a seeker just raised something. The Academy is what a volunteer works
 * through *before* that conversation, in their own time, in order.
 *
 * It is also different from Practice. Practice is a simulated seeker who will
 * not be impressed by you. The Academy is the reading that makes the practice
 * worth doing. Lessons name the scenarios that exercise them, so the two halves
 * of training point at each other.
 *
 * The curriculum is data, not code, and it lives in `@nexus/academy`. A
 * ministry's apologetics lead should be able to fill it in by editing one file
 * and opening a pull request, without knowing anything about this repository.
 */

/**
 * How finished a lesson is — stated plainly to the volunteer.
 *
 * A training library that hides its own gaps teaches volunteers to trust it
 * more than it deserves. Nexus ships the outline with almost every lesson
 * unwritten, and says so on the page.
 */
export type AcademyLessonStatus =
  /** Written, reviewed, and ready to read. */
  | "published"
  /** Being written now. Named so a volunteer knows it is coming. */
  | "drafting"
  /** Part of the plan, nobody has started it. */
  | "planned";

export interface AcademyLesson {
  readonly id: string;
  readonly title: string;
  /** One or two sentences. Shown in the index, and above the lesson itself. */
  readonly summary: string;
  readonly status: AcademyLessonStatus;
  /** Rough reading time, in minutes. Absent until the lesson is written. */
  readonly minutes?: number;
  /**
   * Who wrote or approved this, shown to the volunteer.
   *
   * Same reasoning as the knowledge base: a volunteer about to repeat an
   * argument in public should know whose argument it is.
   */
  readonly source?: string;
  /** Practice scenarios that exercise this lesson, by id. */
  readonly practiceScenarioIds?: readonly string[];
  /**
   * The lesson, in the small markdown subset `parseLesson` understands.
   *
   * Present when `status` is `"published"`, absent otherwise.
   */
  readonly body?: string;
}

export interface AcademyTrack {
  readonly id: string;
  readonly title: string;
  /** What a volunteer gets out of this track, in a sentence. */
  readonly summary: string;
  readonly lessons: readonly AcademyLesson[];
}

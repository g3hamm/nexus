/**
 * The Apologetics Academy: structured training for volunteers.
 *
 * A module is a unit of learning, not a page of reading. It has something to
 * say, and it has an exercise — a practice conversation with a simulated
 * seeker who will not be impressed by the volunteer having just read about
 * this. Reading alone produces someone who can describe the right move and
 * has never made it under pressure, in a second language, at midnight.
 *
 * So the loop a module offers is: read it, practise it, get told honestly how
 * that went. The last step is the reason the module knows what it `teaches` —
 * the debrief is given the module the volunteer had just worked through, and
 * marks the conversation against it as well as against the scenario.
 *
 * This is deliberately a different thing from the knowledge base. The
 * knowledge base is retrieval — material handed to a volunteer mid-conversation
 * because a seeker just raised something. The Academy is what they work
 * through beforehand, in their own time, in order.
 *
 * The curriculum is data, not code, and it lives in `@nexus/academy`. A
 * ministry's apologetics lead should be able to fill it in by editing one file
 * and opening a pull request, without knowing anything about this repository.
 */

/**
 * How finished a module's writing is — stated plainly to the volunteer.
 *
 * A training library that hides its own gaps teaches volunteers to trust it
 * more than it deserves. Nexus ships the outline with most modules unwritten,
 * and says so on the page.
 *
 * Note that this describes the *reading* only. An unwritten module can still
 * carry a working exercise, and several do.
 */
export type AcademyModuleStatus =
  /** Written, reviewed, and ready to read. */
  | "published"
  /** Being written now. Named so a volunteer knows it is coming. */
  | "drafting"
  /** Part of the plan, nobody has started it. */
  | "planned";

export interface AcademyModule {
  readonly id: string;
  readonly title: string;
  /** One or two sentences. Shown in the index, and above the module itself. */
  readonly summary: string;
  readonly status: AcademyModuleStatus;
  /** Rough reading time, in minutes. Absent until the module is written. */
  readonly minutes?: number;
  /**
   * Who wrote or approved this, shown to the volunteer.
   *
   * Same reasoning as the knowledge base: a volunteer about to repeat an
   * argument in public should know whose argument it is.
   */
  readonly source?: string;
  /**
   * What this module is trying to make the volunteer able to do.
   *
   * Not a summary in list form. These are the specific behaviours the debrief
   * is asked to look for afterwards, so they should be things a person can be
   * observed doing or failing to do in a conversation.
   */
  readonly teaches?: readonly string[];
  /**
   * The module's exercise: practice scenarios that put it to work, by id.
   *
   * A module without one is reading, and reading is half of this.
   */
  readonly exercises?: readonly string[];
  /**
   * The module itself, in the small markdown subset `parseModuleBody` reads.
   *
   * Present when `status` is `"published"`, absent otherwise.
   */
  readonly body?: string;
}

/**
 * What the debrief is told about the module a volunteer had just worked
 * through, so its feedback is anchored to what they were trying to learn.
 *
 * Structural rather than the whole module, so `@nexus/practice` needs to know
 * nothing about the Academy's shape beyond this.
 */
export interface AcademyModuleBrief {
  readonly title: string;
  readonly summary: string;
  readonly teaches?: readonly string[];
}

export interface AcademyTrack {
  readonly id: string;
  readonly title: string;
  /** What a volunteer gets out of this track, in a sentence. */
  readonly summary: string;
  readonly modules: readonly AcademyModule[];
}

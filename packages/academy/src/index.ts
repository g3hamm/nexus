/**
 * @nexus/academy — the Apologetics Academy.
 *
 * A volunteer-only training library: tracks of lessons, written by a ministry's
 * apologetics lead, cross-linked to the practice scenarios that exercise them.
 *
 * The curriculum is data (`curriculum.ts`) and the lesson format is a tiny
 * markdown subset parsed to plain blocks (`markdown.ts`). Neither touches the
 * database, the model, or the network — the Academy is the same for everyone
 * and ships with the code.
 */
import type { AcademyLesson, AcademyLessonStatus, AcademyTrack } from "@nexus/core";
import { ACADEMY_TRACKS } from "./curriculum.js";

export { ACADEMY_TRACKS } from "./curriculum.js";
export {
  parseLesson,
  parseInline,
  type LessonBlock,
  type InlineSpan,
} from "./markdown.js";

/** A lesson together with the track it belongs to. */
export interface AcademyLocation {
  readonly track: AcademyTrack;
  readonly lesson: AcademyLesson;
}

/** Finds a lesson by id across every track. Ids are unique; see the test. */
export function findAcademyLesson(
  lessonId: string,
  tracks: readonly AcademyTrack[] = ACADEMY_TRACKS,
): AcademyLocation | undefined {
  for (const track of tracks) {
    const lesson = track.lessons.find((l) => l.id === lessonId);
    if (lesson) return { track, lesson };
  }
  return undefined;
}

/**
 * How much of the curriculum is actually written.
 *
 * Shown on the index, because a training library that hides its own gaps
 * teaches volunteers to trust it further than it has earned.
 */
export function academyProgress(
  tracks: readonly AcademyTrack[] = ACADEMY_TRACKS,
): Record<AcademyLessonStatus, number> & { readonly total: number } {
  const counts = { published: 0, drafting: 0, planned: 0, total: 0 };
  for (const track of tracks) {
    for (const lesson of track.lessons) {
      counts[lesson.status] += 1;
      counts.total += 1;
    }
  }
  return counts;
}

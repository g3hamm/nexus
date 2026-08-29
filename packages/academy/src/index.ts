/**
 * @nexus/academy — the Apologetics Academy.
 *
 * A volunteer-only training library, organised as modules: something to read,
 * an exercise against a simulated seeker who has not read it, and an honest
 * debrief that knows which module the volunteer had just worked through.
 *
 * The curriculum is data (`curriculum.ts`) and the module format is a tiny
 * markdown subset parsed to plain blocks (`markdown.ts`). Neither touches the
 * database, the model, or the network — the Academy's own content is the same
 * for everyone and ships with the code. The exercises run on the existing
 * practice engine, so there is one simulated seeker and one debrief in this
 * codebase rather than two that can drift apart.
 */
import type {
  AcademyModule,
  AcademyModuleBrief,
  AcademyModuleStatus,
  AcademyTrack,
} from "@nexus/core";
import { ACADEMY_TRACKS } from "./curriculum.js";

export { ACADEMY_TRACKS } from "./curriculum.js";
export {
  parseModuleBody,
  parseInline,
  type ProseBlock,
  type InlineSpan,
} from "./markdown.js";

/** A module together with the track it belongs to. */
export interface AcademyLocation {
  readonly track: AcademyTrack;
  readonly module: AcademyModule;
}

/** Finds a module by id across every track. Ids are unique; see the test. */
export function findAcademyModule(
  moduleId: string,
  tracks: readonly AcademyTrack[] = ACADEMY_TRACKS,
): AcademyLocation | undefined {
  for (const track of tracks) {
    const found = track.modules.find((m) => m.id === moduleId);
    if (found) return { track, module: found };
  }
  return undefined;
}

/**
 * The module a debrief should be marked against, given what the volunteer
 * claims they were working through.
 *
 * The pairing is checked rather than trusted: a module only counts if the
 * scenario really is one of its exercises. Nothing here is dangerous — the
 * worst a bad hint could do is anchor somebody's own private feedback to the
 * wrong reading — but silently accepting a mismatch would make the debrief
 * quietly wrong in a way nobody would ever catch.
 */
export function briefForExercise(
  moduleId: string | undefined,
  scenarioId: string,
  tracks: readonly AcademyTrack[] = ACADEMY_TRACKS,
): AcademyModuleBrief | undefined {
  if (!moduleId) return undefined;

  const found = findAcademyModule(moduleId, tracks);
  if (!found?.module.exercises?.includes(scenarioId)) return undefined;

  const { title, summary, teaches } = found.module;
  return teaches ? { title, summary, teaches } : { title, summary };
}

/**
 * How much of the curriculum is written, and how much of it can be practised.
 *
 * Both are shown on the index. A training library that hides its own gaps
 * teaches volunteers to trust it further than it has earned — and the second
 * number is the more useful one, because a module nobody has written yet can
 * still hand somebody a hard conversation to have.
 */
export function academyProgress(tracks: readonly AcademyTrack[] = ACADEMY_TRACKS): Record<
  AcademyModuleStatus,
  number
> & {
  readonly total: number;
  readonly withExercise: number;
} {
  const counts = { published: 0, drafting: 0, planned: 0, total: 0, withExercise: 0 };
  for (const track of tracks) {
    for (const module of track.modules) {
      counts[module.status] += 1;
      counts.total += 1;
      if ((module.exercises?.length ?? 0) > 0) counts.withExercise += 1;
    }
  }
  return counts;
}

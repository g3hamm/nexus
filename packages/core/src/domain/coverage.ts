/**
 * Whether anyone is actually here.
 *
 * The landing page says "someone will be here to talk with you." That is a
 * promise, and a promise the software has to be able to keep. A person who
 * writes down something they have never told anyone, at three in the morning,
 * and then watches a spinner that means nothing is worse off than a person
 * who was told the truth and chose to write it anyway.
 *
 * So coverage exists to make the waiting state honest. It is deliberately
 * coarse — three words, never a queue position, never a count, never an
 * estimated wait. "You are fourth in line, about 25 minutes" is a reason to
 * close the tab, and it is a number we would frequently get wrong.
 */
export type CoverageState =
  /** Someone is free right now. */
  | "open"
  /** Volunteers are here, all of them mid-conversation. */
  | "busy"
  /** Nobody is on. */
  | "closed";

export interface Coverage {
  readonly state: CoverageState;
  /**
   * Volunteers free to take someone now.
   *
   * Operational detail for the admin dashboard. Never sent to a seeker — the
   * number of people staffing a ministry is not something a person in
   * distress benefits from knowing, in either direction.
   */
  readonly freeNow: number;
  /** Volunteers signed in and working, free or not. Also admin-only. */
  readonly onlineNow: number;
}

export function coverageStateFrom(freeNow: number, onlineNow: number): CoverageState {
  if (freeNow > 0) return "open";
  if (onlineNow > 0) return "busy";
  return "closed";
}

/**
 * Whether a seeker arriving now can expect to be answered in this sitting.
 *
 * Drives which words the front door uses, and nothing else. It never blocks
 * anyone from writing: someone who has worked up to saying something should
 * always be able to say it, and a message left with nobody on is still read
 * by whoever comes on next.
 */
export function someoneIsHere(coverage: Coverage): boolean {
  return coverage.state !== "closed";
}

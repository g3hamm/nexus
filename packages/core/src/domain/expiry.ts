import type { Conversation } from "./conversation.js";

/**
 * When a conversation closes, and when its link stops working.
 *
 * A conversation URL that stays good forever is a transcript sitting behind a
 * guess. It is not only a guess today — the seeker's browser holds a signed
 * cookie and the page checks that the conversation is theirs — but a link that
 * never expires is one shared device, one borrowed phone, or one browser left
 * open in a house where this conversation is dangerous away from being read by
 * someone it was never meant for. Several of the people this is built for live
 * in exactly that house.
 *
 * The opposite failure is just as real. Someone who closes the tab to answer
 * the door, or puts the phone down and cries for twenty minutes, must find the
 * conversation still there. So nothing here is immediate, and the numbers are
 * chosen to survive an interruption and not much more.
 *
 * Three clocks, in the order a conversation meets them:
 *
 *   1. Silence closes it. Three hours for a conversation somebody is in;
 *      twelve for one still waiting to be picked up, because the front door
 *      promises a seeker their message will be waiting for whoever comes on
 *      next, and a promise the software quietly breaks overnight is worse
 *      than one it never made.
 *   2. Closing it starts a grace period. An hour, so that "goodbye" is still
 *      on screen when the volunteer or the seeker looks back at it, and the
 *      last thing said can be re-read.
 *   3. Then the link is done. The page stops rendering, the API stops
 *      answering, and starting again means starting a new conversation.
 *
 * The transcript is a separate question with a separate clock — see
 * `retainUntil` and the retention purge. This is about who can open the door;
 * that is about how long anything is kept behind it.
 */

const HOUR = 3_600_000;

/** Silence in a conversation somebody is actually in. */
export const ACTIVE_IDLE_MS = 3 * HOUR;

/**
 * Silence in a conversation nobody has picked up.
 *
 * Twelve hours, matching the seeker's own session, so the two cannot disagree
 * about how long coming back on the same device is meant to work.
 */
export const WAITING_IDLE_MS = 12 * HOUR;

/** How long a closed conversation stays readable. */
export const CLOSED_GRACE_MS = 1 * HOUR;

/**
 * How long a closed conversation stays readable when somebody in it was
 * judged to be at risk of their life.
 *
 * The crisis card carries the helpline numbers for their country, and it is
 * the one thing on this screen that a person might genuinely need again
 * tomorrow morning. Taking it away an hour after a hard conversation ends, to
 * enforce a privacy rule about a transcript they wrote themselves, gets the
 * balance wrong in the one case where being wrong matters most.
 */
export const CRISIS_GRACE_MS = 24 * HOUR;

/**
 * How long silence is allowed before this conversation closes itself.
 *
 * Null when the conversation is not live, and so has no idle clock at all.
 */
export function idleLimitFor(conversation: Conversation): number | null {
  switch (conversation.status) {
    case "waiting":
      return WAITING_IDLE_MS;
    case "active":
      return ACTIVE_IDLE_MS;
    // "under_review" is deliberately absent. A conversation held for an
    // administrator to look at must not close itself out from under them.
    default:
      return null;
  }
}

/** True when a live conversation has been silent long enough to close. */
export function hasGoneIdle(
  conversation: Conversation,
  lastActivityAt: Date,
  now: Date,
): boolean {
  const limit = idleLimitFor(conversation);
  if (limit === null) return false;
  return now.getTime() - lastActivityAt.getTime() >= limit;
}

/**
 * When this conversation's link stops working, or null while it is still live.
 *
 * Derived rather than stored, so changing a number here changes every door at
 * once and cannot leave a conversation carrying a deadline from an older
 * policy.
 */
export function linkExpiresAt(conversation: Conversation): Date | null {
  if (conversation.endedAt === null) return null;
  const grace = conversation.crisisRaisedAt === null ? CLOSED_GRACE_MS : CRISIS_GRACE_MS;
  return new Date(conversation.endedAt.getTime() + grace);
}

/** True when the link is done and nothing should serve this conversation. */
export function linkHasExpired(conversation: Conversation, now: Date): boolean {
  const expires = linkExpiresAt(conversation);
  return expires !== null && now.getTime() >= expires.getTime();
}

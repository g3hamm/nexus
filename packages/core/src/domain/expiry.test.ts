import { describe, expect, it } from "vitest";
import type { Conversation } from "./conversation.js";
import {
  ACTIVE_IDLE_MS,
  CLOSED_GRACE_MS,
  CRISIS_GRACE_MS,
  WAITING_IDLE_MS,
  hasGoneIdle,
  idleLimitFor,
  linkExpiresAt,
  linkHasExpired,
} from "./expiry.js";

const NOW = new Date("2026-08-29T12:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);

function conversation(over: Partial<Conversation> = {}): Conversation {
  return {
    id: "c1",
    seekerId: "s1",
    seekerName: "Sam",
    volunteerId: null,
    status: "waiting",
    roomId: "r1",
    modality: "text",
    seekerLanguage: "en",
    volunteerLanguage: null,
    translationRequired: false,
    startedAt: ago(WAITING_IDLE_MS),
    matchedAt: null,
    lastModeratedAt: null,
    crisisRaisedAt: null,
    practiceScenario: null,
    endedAt: null,
    retainUntil: null,
    ...over,
  } as Conversation;
}

describe("when a conversation closes itself", () => {
  it("gives a conversation somebody is in three hours of silence", () => {
    const active = conversation({ status: "active" });
    expect(idleLimitFor(active)).toBe(ACTIVE_IDLE_MS);
    expect(hasGoneIdle(active, ago(ACTIVE_IDLE_MS - 60_000), NOW)).toBe(false);
    expect(hasGoneIdle(active, ago(ACTIVE_IDLE_MS), NOW)).toBe(true);
  });

  // The front door tells a seeker their message will be waiting for whoever
  // comes on next. Closing it after three hours makes that a lie overnight.
  it("gives a conversation nobody has picked up twelve", () => {
    const waiting = conversation({ status: "waiting" });
    expect(idleLimitFor(waiting)).toBe(WAITING_IDLE_MS);
    expect(hasGoneIdle(waiting, ago(ACTIVE_IDLE_MS), NOW)).toBe(false);
    expect(hasGoneIdle(waiting, ago(WAITING_IDLE_MS), NOW)).toBe(true);
  });

  // Somebody stepped away from their desk. Coming back to a conversation that
  // closed while they answered the door is the failure this guards against.
  it("survives an interruption", () => {
    const active = conversation({ status: "active" });
    expect(hasGoneIdle(active, ago(45 * 60_000), NOW)).toBe(false);
  });

  it("leaves a conversation held for review alone", () => {
    const held = conversation({ status: "under_review" });
    expect(idleLimitFor(held)).toBeNull();
    expect(hasGoneIdle(held, ago(30 * 24 * 3_600_000), NOW)).toBe(false);
  });

  it.each(["ended", "terminated"] as const)("has no idle clock once %s", (status) => {
    expect(idleLimitFor(conversation({ status }))).toBeNull();
  });
});

describe("when the link stops working", () => {
  it("stays open while the conversation is live", () => {
    expect(linkExpiresAt(conversation())).toBeNull();
    expect(linkHasExpired(conversation(), NOW)).toBe(false);
  });

  // Not immediately, on purpose. "Goodbye" should still be on screen.
  it("gives an hour after it closes", () => {
    const ended = conversation({ status: "ended", endedAt: ago(30 * 60_000) });
    expect(linkHasExpired(ended, NOW)).toBe(false);

    const older = conversation({ status: "ended", endedAt: ago(CLOSED_GRACE_MS) });
    expect(linkHasExpired(older, NOW)).toBe(true);
  });

  // The crisis card carries this person's helpline numbers, and it is the one
  // thing on the screen they might genuinely need again tomorrow morning.
  it("keeps a conversation that reached a crisis open for a day", () => {
    const ended = conversation({
      status: "ended",
      endedAt: ago(6 * 3_600_000),
      crisisRaisedAt: ago(7 * 3_600_000),
    });
    expect(linkHasExpired(ended, NOW)).toBe(false);

    const old = conversation({
      status: "ended",
      endedAt: ago(CRISIS_GRACE_MS),
      crisisRaisedAt: ago(CRISIS_GRACE_MS + 3_600_000),
    });
    expect(linkHasExpired(old, NOW)).toBe(true);
  });

  it("closes an administrator's termination on the same clock", () => {
    const terminated = conversation({
      status: "terminated",
      endedAt: ago(CLOSED_GRACE_MS),
    });
    expect(linkHasExpired(terminated, NOW)).toBe(true);
  });
});

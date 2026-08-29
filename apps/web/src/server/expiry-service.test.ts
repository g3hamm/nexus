import { beforeEach, describe, expect, it } from "vitest";
import {
  ACTIVE_IDLE_MS,
  CLOSED_GRACE_MS,
  CRISIS_GRACE_MS,
  WAITING_IDLE_MS,
  asSeekerId,
  asVolunteerId,
} from "@nexus/core";
import type { Conversation } from "@nexus/core";
import type { Container } from "./container";
import { ExpiryService } from "./expiry-service";
import {
  FakeAuditLog,
  FakeConversationRepository,
  FakeMessageRepository,
} from "@/test/fakes";

const NOW = new Date("2026-08-29T12:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);

function harness() {
  const conversations = new FakeConversationRepository();
  const messages = new FakeMessageRepository();
  const audit = new FakeAuditLog();
  const container = { conversations, messages, audit } as unknown as Container;
  return { conversations, messages, audit, service: new ExpiryService(container) };
}

describe("ExpiryService", () => {
  let h: ReturnType<typeof harness>;
  beforeEach(() => {
    h = harness();
  });

  async function conversation(over: Partial<Conversation> = {}) {
    const created = await h.conversations.create({
      seekerId: asSeekerId("skr_1"),
      seekerLanguage: "fa",
      modality: "text",
      retainUntil: null,
      seekerName: "Sam",
    });
    const row = { ...created, ...over };
    h.conversations.rows.set(created.id, row);
    return row;
  }

  describe("at the door", () => {
    it("leaves a conversation somebody is still in alone", async () => {
      const live = await conversation({
        status: "active",
        volunteerId: asVolunteerId("vol_1"),
        startedAt: ago(20 * 60_000),
      });

      const resolved = await h.service.resolve(live, NOW);
      expect(resolved?.status).toBe("active");
      expect(h.audit.entries).toHaveLength(0);
    });

    // The whole reason nothing here is immediate. Someone put the phone down.
    it("survives an interruption", async () => {
      const live = await conversation({
        status: "active",
        startedAt: ago(ACTIVE_IDLE_MS - 60_000),
      });
      expect((await h.service.resolve(live, NOW))?.status).toBe("active");
    });

    it("closes one that has gone quiet, and still shows it", async () => {
      const stale = await conversation({
        status: "active",
        startedAt: ago(ACTIVE_IDLE_MS + 60_000),
      });

      const resolved = await h.service.resolve(stale, NOW);
      // Closed, and still readable: the grace period starts here rather than
      // access ending here. Somebody coming back overnight should find the
      // last thing said to them and be told plainly that it is over.
      expect(resolved?.status).toBe("ended");
      expect(h.conversations.rows.get(stale.id)?.status).toBe("ended");
    });

    // Its own audit action, so an administrator can tell "the seeker stopped
    // replying" from "the volunteer said goodbye".
    it("records that the platform closed it, not a person", async () => {
      const stale = await conversation({
        status: "active",
        startedAt: ago(ACTIVE_IDLE_MS + 60_000),
      });
      await h.service.resolve(stale, NOW);

      const entry = h.audit.entries.find((e) => e.action === "conversation.expired");
      expect(entry?.actorRole).toBe("system");
      expect(entry?.conversationId).toBe(stale.id);
    });

    it("measures silence from the last message, not from the start", async () => {
      const long = await conversation({
        status: "active",
        startedAt: ago(3 * ACTIVE_IDLE_MS),
      });
      await h.messages.append({
        conversationId: long.id,
        authorRole: "seeker",
        authorId: null,
        originalLanguage: "fa",
        renderings: [{ language: "fa", text: "سلام", source: "original" }],
      });

      expect((await h.service.resolve(long, NOW))?.status).toBe("active");
    });

    it("holds an unanswered conversation for twelve hours, not three", async () => {
      const overnight = await conversation({
        status: "waiting",
        startedAt: ago(WAITING_IDLE_MS - 3_600_000),
      });
      expect((await h.service.resolve(overnight, NOW))?.status).toBe("waiting");

      const abandoned = await conversation({
        status: "waiting",
        startedAt: ago(WAITING_IDLE_MS + 60_000),
      });
      expect((await h.service.resolve(abandoned, NOW))?.status).toBe("ended");
    });

    it("shuts the link once the grace period is over", async () => {
      const done = await conversation({
        status: "ended",
        endedAt: ago(CLOSED_GRACE_MS + 60_000),
      });
      expect(await h.service.resolve(done, NOW)).toBeNull();
    });

    it("keeps a conversation that reached a crisis open for a day", async () => {
      const crisis = await conversation({
        status: "ended",
        endedAt: ago(CLOSED_GRACE_MS + 3_600_000),
        crisisRaisedAt: ago(8 * 3_600_000),
      });
      expect(await h.service.resolve(crisis, NOW)).not.toBeNull();

      const old = await conversation({
        status: "ended",
        endedAt: ago(CRISIS_GRACE_MS + 60_000),
        crisisRaisedAt: ago(CRISIS_GRACE_MS + 3_600_000),
      });
      expect(await h.service.resolve(old, NOW)).toBeNull();
    });

    // Held for an administrator to look at. Closing it out from under them
    // would be the platform overruling the reason it was held.
    it("never closes a conversation under review", async () => {
      const held = await conversation({
        status: "under_review",
        startedAt: ago(30 * 24 * 3_600_000),
      });
      expect((await h.service.resolve(held, NOW))?.status).toBe("under_review");
    });
  });

  describe("on the sweep", () => {
    it("closes what has gone quiet and leaves the rest", async () => {
      const stale = await conversation({
        status: "active",
        startedAt: ago(ACTIVE_IDLE_MS + 60_000),
      });
      const live = await conversation({
        status: "active",
        startedAt: ago(10 * 60_000),
      });

      expect(await h.service.sweep(NOW)).toBe(1);
      expect(h.conversations.rows.get(stale.id)?.status).toBe("ended");
      expect(h.conversations.rows.get(live.id)?.status).toBe("active");
    });

    // A conversation nobody ever ended has no `ended_at`, is never purgeable,
    // and sits in the database forever. Closing it is what starts that clock.
    it("puts an abandoned conversation on a retention clock", async () => {
      const stale = await conversation({
        status: "waiting",
        startedAt: ago(WAITING_IDLE_MS + 60_000),
      });

      await h.service.sweep(NOW);
      expect(h.conversations.rows.get(stale.id)?.endedAt).not.toBeNull();
    });

    it("does nothing twice", async () => {
      await conversation({ status: "active", startedAt: ago(ACTIVE_IDLE_MS + 60_000) });
      expect(await h.service.sweep(NOW)).toBe(1);
      expect(await h.service.sweep(NOW)).toBe(0);
    });
  });
});

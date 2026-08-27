import { beforeEach, describe, expect, it } from "vitest";
import { asSeekerId } from "@nexus/core";
import type { Container } from "./container";
import { RetentionService } from "./retention-service";
import { FakeAuditLog, FakeConversationRepository } from "@/test/fakes";

const DAY = 24 * 60 * 60 * 1000;

function harness(options?: { batchSize?: number; maxPerRun?: number }) {
  const conversations = new FakeConversationRepository();
  const audit = new FakeAuditLog();
  const container = { conversations, audit } as unknown as Container;
  return {
    conversations,
    audit,
    service: new RetentionService(container, options ?? {}),
  };
}

/** A conversation that ended and whose retention window closed `daysAgo`. */
async function expired(
  repo: FakeConversationRepository,
  daysAgo: number,
  status: "ended" | "terminated" = "ended",
) {
  const conversation = await repo.create({
    seekerId: asSeekerId("skr_x"),
    seekerLanguage: "fa",
    modality: "text",
    retainUntil: new Date(Date.now() - daysAgo * DAY),
  });
  await repo.end(conversation.id, status);
  return conversation;
}

describe("RetentionService", () => {
  let h: ReturnType<typeof harness>;
  beforeEach(() => {
    h = harness();
  });

  it("destroys conversations past their retention date", async () => {
    const doomed = await expired(h.conversations, 1);

    const result = await h.service.purgeExpired();

    expect(result.purged).toBe(1);
    expect(await h.conversations.findById(doomed.id)).toBeNull();
  });

  it("leaves conversations still inside their window alone", async () => {
    const keep = await h.conversations.create({
      seekerId: asSeekerId("skr_x"),
      seekerLanguage: "fa",
      modality: "text",
      retainUntil: new Date(Date.now() + 30 * DAY),
    });
    await h.conversations.end(keep.id, "ended");

    const result = await h.service.purgeExpired();

    expect(result.purged).toBe(0);
    expect(await h.conversations.findById(keep.id)).not.toBeNull();
  });

  it("never touches a live conversation, whatever its retention date says", async () => {
    // Waiting, with a retainUntil already in the past.
    const live = await h.conversations.create({
      seekerId: asSeekerId("skr_x"),
      seekerLanguage: "fa",
      modality: "text",
      retainUntil: new Date(Date.now() - 10 * DAY),
    });

    await h.service.purgeExpired();

    expect(await h.conversations.findById(live.id)).not.toBeNull();
  });

  it("never touches a conversation under review", async () => {
    const flagged = await expired(h.conversations, 30);
    await h.conversations.markUnderReview(flagged.id);

    const result = await h.service.purgeExpired();

    expect(result.purged).toBe(0);
    expect(await h.conversations.findById(flagged.id)).not.toBeNull();
  });

  it("never touches a conversation carrying an unresolved flag", async () => {
    const flagged = await expired(h.conversations, 30);
    h.conversations.openFlagFor.add(flagged.id);

    const result = await h.service.purgeExpired();

    expect(result.purged).toBe(0);
    expect(await h.conversations.findById(flagged.id)).not.toBeNull();
  });

  it("treats a null retention date as keep forever", async () => {
    const keep = await h.conversations.create({
      seekerId: asSeekerId("skr_x"),
      seekerLanguage: "fa",
      modality: "text",
      retainUntil: null,
    });
    await h.conversations.end(keep.id, "ended");

    expect((await h.service.purgeExpired()).purged).toBe(0);
    expect(await h.conversations.findById(keep.id)).not.toBeNull();
  });

  it("purges terminated conversations too, not only ended ones", async () => {
    await expired(h.conversations, 5, "terminated");
    expect((await h.service.purgeExpired()).purged).toBe(1);
  });

  it("works through a backlog in batches, oldest first", async () => {
    const batched = harness({ batchSize: 2 });
    for (const days of [10, 40, 30, 20, 50]) {
      await expired(batched.conversations, days);
    }

    const result = await batched.service.purgeExpired();

    expect(result.purged).toBe(5);
    expect(result.batches).toBe(3); // 2 + 2 + 1
  });

  it("stops at the per-run ceiling and says so", async () => {
    const capped = harness({ batchSize: 2, maxPerRun: 4 });
    for (let i = 0; i < 10; i++) await expired(capped.conversations, 10 + i);

    const result = await capped.service.purgeExpired();

    expect(result.purged).toBe(4);
    expect(result.reachedLimit).toBe(true);
    // The rest survive to be picked up by the next run.
    expect((await capped.conversations.findWaiting(100)).length).toBe(0);
  });

  it("records the purge without recording what was in it", async () => {
    await expired(h.conversations, 1);
    await h.service.purgeExpired();

    const entry = h.audit.entries.find((e) => e.action === "conversation.purged");
    expect(entry).toBeDefined();
    expect(entry?.detail.removed).toBe(1);
    // Ids only. The audit log must not become a second index of who talked to us.
    expect(JSON.stringify(entry?.detail)).not.toMatch(/language|seeker_|text/i);
  });

  it("does nothing, quietly, when there is nothing to purge", async () => {
    const result = await h.service.purgeExpired();
    expect(result).toMatchObject({ purged: 0, batches: 0, reachedLimit: false });
    expect(h.audit.entries).toHaveLength(0);
  });
});

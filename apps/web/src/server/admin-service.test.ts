import { beforeEach, describe, expect, it } from "vitest";
import type { ModerationVerdict } from "@nexus/core";
import { asAdminId, asSeekerId, asVolunteerId } from "@nexus/core";
import type { Container } from "./container";
import {
  AdminService,
  RETENTION_AFTER_DISMISSAL_DAYS,
  RETENTION_AFTER_UPHELD_DAYS,
} from "./admin-service";
import {
  FakeAuditLog,
  FakeConversationRepository,
  FakeFlagRepository,
  FakeMessageRepository,
  FakeVolunteerRepository,
  fakeVolunteer,
} from "@/test/fakes";

const ADMIN = asAdminId("adm-1");
const DAY = 24 * 60 * 60 * 1000;

function harness() {
  const conversations = new FakeConversationRepository();
  const messages = new FakeMessageRepository();
  const flags = new FakeFlagRepository();
  const volunteers = new FakeVolunteerRepository();
  const audit = new FakeAuditLog();

  const container = {
    conversations,
    messages,
    flags,
    volunteers,
    audit,
  } as unknown as Container;

  return {
    conversations,
    messages,
    flags,
    volunteers,
    audit,
    service: new AdminService(container),
  };
}

const verdict = (over: Partial<ModerationVerdict> = {}): ModerationVerdict => ({
  category: "spiritual_coercion",
  severity: "high",
  subject: "volunteer",
  rationale: "The volunteer pressed for a decision repeatedly.",
  action: "flag_for_review",
  evidenceMessageIds: [],
  confidence: 0.85,
  ...over,
});

/** A flagged conversation held under review, as the judge would leave it. */
async function flaggedConversation(h: ReturnType<typeof harness>) {
  const conversation = await h.conversations.create({
    seekerId: asSeekerId("skr_1"),
    seekerLanguage: "fa",
    modality: "text",
    retainUntil: new Date(Date.now() + 90 * DAY),
  });
  await h.conversations.claim(conversation.id, asVolunteerId("vol-1"), "en");
  await h.messages.append({
    conversationId: conversation.id,
    authorRole: "seeker",
    authorId: null,
    originalLanguage: "fa",
    renderings: [
      { language: "fa", text: "سلام", source: "original" },
      { language: "en", text: "Hello", source: "machine" },
    ],
  });
  const flag = await h.flags.raise(conversation.id, verdict());
  await h.conversations.markUnderReview(conversation.id);
  return { conversation, flag };
}

describe("reading a transcript", () => {
  let h: ReturnType<typeof harness>;
  beforeEach(() => {
    h = harness();
  });

  it("records the read against the admin before returning anything", async () => {
    const { conversation } = await flaggedConversation(h);

    await h.service.transcriptFor(conversation.id, ADMIN);

    const entry = h.audit.entries.find((e) => e.action === "conversation.viewed");
    expect(entry).toBeDefined();
    expect(entry?.actorRole).toBe("admin");
    expect(entry?.actorId).toBe(ADMIN);
    expect(entry?.conversationId).toBe(conversation.id);
  });

  it("records every read, not just the first", async () => {
    const { conversation } = await flaggedConversation(h);

    await h.service.transcriptFor(conversation.id, ADMIN);
    await h.service.transcriptFor(conversation.id, ADMIN);

    expect(
      h.audit.entries.filter((e) => e.action === "conversation.viewed"),
    ).toHaveLength(2);
  });

  it("distinguishes an export from a read", async () => {
    const { conversation } = await flaggedConversation(h);
    await h.service.transcriptFor(conversation.id, ADMIN, "export");

    expect(h.audit.entries.some((e) => e.action === "conversation.exported")).toBe(true);
  });

  it("returns both the original and the English rendering", async () => {
    const { conversation } = await flaggedConversation(h);
    const { lines } = await h.service.transcriptFor(conversation.id, ADMIN);

    // The translation is a machine's opinion and may be what went wrong.
    expect(lines[0]?.originalText).toBe("سلام");
    expect(lines[0]?.originalLanguage).toBe("fa");
    expect(lines[0]?.englishText).toBe("Hello");
  });

  it("refuses a conversation that does not exist, without auditing a read", async () => {
    const { asConversationId } = await import("@nexus/core");
    await expect(
      h.service.transcriptFor(asConversationId("nope"), ADMIN),
    ).rejects.toThrow(/not found/);
    expect(h.audit.entries).toHaveLength(0);
  });
});

describe("resolving a flag", () => {
  let h: ReturnType<typeof harness>;
  beforeEach(() => {
    h = harness();
  });

  it("puts a dismissed conversation back on the ordinary clock", async () => {
    const { conversation, flag } = await flaggedConversation(h);
    expect((await h.conversations.findById(conversation.id))?.retainUntil).toBeNull();

    await h.service.resolveFlag(flag.id, ADMIN, "dismissed", "Misread the tone.");

    const after = await h.conversations.findById(conversation.id);
    // Without this the transcript would be exempt from the purge forever.
    expect(after?.retainUntil).not.toBeNull();
    expect(after?.status).toBe("active");

    const days = (after!.retainUntil!.getTime() - Date.now()) / DAY;
    expect(Math.round(days)).toBe(RETENTION_AFTER_DISMISSAL_DAYS);
  });

  it("keeps an upheld conversation for longer, but not forever", async () => {
    const { conversation, flag } = await flaggedConversation(h);

    await h.service.resolveFlag(flag.id, ADMIN, "upheld", "Volunteer spoken to.");

    const after = await h.conversations.findById(conversation.id);
    const days = (after!.retainUntil!.getTime() - Date.now()) / DAY;
    expect(Math.round(days)).toBe(RETENTION_AFTER_UPHELD_DAYS);
    expect(after?.retainUntil).not.toBeNull();
  });

  it("keeps the conversation exempt while another flag is still open", async () => {
    const { conversation, flag } = await flaggedConversation(h);
    await h.flags.raise(conversation.id, verdict({ category: "off_mission" }));

    await h.service.resolveFlag(flag.id, ADMIN, "dismissed", "This one is fine.");

    // Two concerns, one dealt with. Still evidence.
    const after = await h.conversations.findById(conversation.id);
    expect(after?.retainUntil).toBeNull();
    expect(after?.status).toBe("under_review");
  });

  it("restores retention once the last flag is dealt with", async () => {
    const { conversation, flag } = await flaggedConversation(h);
    const second = await h.flags.raise(
      conversation.id,
      verdict({ category: "off_mission" }),
    );

    await h.service.resolveFlag(flag.id, ADMIN, "dismissed", "Fine.");
    await h.service.resolveFlag(second.id, ADMIN, "dismissed", "Also fine.");

    expect((await h.conversations.findById(conversation.id))?.retainUntil).not.toBeNull();
  });

  it("records the decision and who made it", async () => {
    const { flag } = await flaggedConversation(h);
    await h.service.resolveFlag(flag.id, ADMIN, "upheld", "Escalated to the pastor.");

    const entry = h.audit.entries.find((e) => e.action === "flag.resolved");
    expect(entry?.actorId).toBe(ADMIN);
    expect(entry?.detail.decision).toBe("upheld");
    expect(entry?.detail.retentionRestored).toBe(true);

    const stored = await h.flags.findById(flag.id);
    expect(stored?.status).toBe("upheld");
    expect(stored?.reviewNote).toBe("Escalated to the pastor.");
  });

  it("refuses to review the same flag twice", async () => {
    const { flag } = await flaggedConversation(h);
    await h.service.resolveFlag(flag.id, ADMIN, "dismissed", "Fine.");

    await expect(
      h.service.resolveFlag(flag.id, ADMIN, "upheld", "Changed my mind."),
    ).rejects.toThrow(/already been reviewed/);
  });

  it("returns an ended conversation to ended, not to active", async () => {
    const { conversation, flag } = await flaggedConversation(h);
    await h.conversations.end(conversation.id, "ended");
    await h.conversations.markUnderReview(conversation.id);

    await h.service.resolveFlag(flag.id, ADMIN, "dismissed", "Fine.");

    expect((await h.conversations.findById(conversation.id))?.status).toBe("ended");
  });
});

describe("managing volunteers", () => {
  let h: ReturnType<typeof harness>;
  beforeEach(() => {
    h = harness();
  });

  it("approves a volunteer and records who did it", async () => {
    const volunteer = h.volunteers.add(
      fakeVolunteer({ id: asVolunteerId("vol-9"), approvedAt: null }),
    );

    await h.service.setVolunteerApproved(volunteer.id, ADMIN, true);

    expect((await h.volunteers.findById(volunteer.id))?.approvedAt).not.toBeNull();
    const entry = h.audit.entries.find((e) => e.action === "volunteer.approved");
    expect(entry?.actorId).toBe(ADMIN);
    expect(entry?.detail.approved).toBe(true);
  });

  it("suspending also takes the volunteer offline", async () => {
    const volunteer = h.volunteers.add(
      fakeVolunteer({ id: asVolunteerId("vol-9"), status: "available" }),
    );

    await h.service.setVolunteerSuspended(volunteer.id, ADMIN, true);

    const after = await h.volunteers.findById(volunteer.id);
    expect(after?.suspendedAt).not.toBeNull();
    // Otherwise the matcher would keep handing them conversations.
    expect(after?.status).toBe("offline");
    expect(await h.volunteers.findAvailable()).toHaveLength(0);
  });

  it("reinstates a suspended volunteer", async () => {
    const volunteer = h.volunteers.add(
      fakeVolunteer({ id: asVolunteerId("vol-9"), suspendedAt: new Date() }),
    );

    await h.service.setVolunteerSuspended(volunteer.id, ADMIN, false);

    expect((await h.volunteers.findById(volunteer.id))?.suspendedAt).toBeNull();
  });
});

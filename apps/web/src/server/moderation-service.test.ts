import { beforeEach, describe, expect, it } from "vitest";
import { asSeekerId, type ModerationVerdict } from "@nexus/core";
import { InMemoryTransport } from "@nexus/realtime";
import type { Container } from "./container";
import { ModerationService } from "./moderation-service";
import {
  FakeAuditLog,
  FakeConversationRepository,
  FakeFlagRepository,
  FakeMessageRepository,
  StubJudge,
  StubScheduler,
  fakeVolunteer,
} from "@/test/fakes";

function harness(options: { due?: boolean } = {}) {
  const conversations = new FakeConversationRepository();
  const messages = new FakeMessageRepository();
  const flags = new FakeFlagRepository();
  const audit = new FakeAuditLog();
  const realtime = new InMemoryTransport();
  const judge = new StubJudge();

  const container = {
    conversations,
    messages,
    flags,
    audit,
    realtime,
    judge,
    moderationScheduler: new StubScheduler(options.due ?? true),
  } as unknown as Container;

  return {
    conversations,
    messages,
    flags,
    audit,
    realtime,
    judge,
    service: new ModerationService(container),
  };
}

async function activeConversation(h: ReturnType<typeof harness>) {
  const { conversation } = {
    conversation: await h.conversations.create({
      seekerId: asSeekerId("skr_1"),
      seekerLanguage: "fa",
      modality: "text",
      retainUntil: new Date(Date.now() + 90 * 86_400_000),
    }),
  };
  await h.conversations.claim(conversation.id, fakeVolunteer().id, "en");
  await h.messages.append({
    conversationId: conversation.id,
    authorRole: "seeker",
    authorId: null,
    originalLanguage: "fa",
    renderings: [{ language: "fa", text: "سلام", source: "original" }],
  });
  return conversation;
}

const verdict = (over: Partial<ModerationVerdict>): Partial<ModerationVerdict> => over;

describe("ModerationService", () => {
  let h: ReturnType<typeof harness>;
  beforeEach(() => {
    h = harness();
  });

  it("does nothing when the scheduler says it is not due", async () => {
    const quiet = harness({ due: false });
    const conversation = await activeConversation(quiet);

    expect(await quiet.service.reviewIfDue(conversation.id)).toBeNull();
    expect(quiet.judge.reviews).toHaveLength(0);
  });

  it("records that it looked, so the cadence advances", async () => {
    const conversation = await activeConversation(h);
    await h.service.reviewIfDue(conversation.id);

    const after = await h.conversations.findById(conversation.id);
    expect(after?.lastModeratedAt).not.toBeNull();
  });

  it("raises no flag for a clean verdict", async () => {
    const conversation = await activeConversation(h);
    await h.service.reviewIfDue(conversation.id);

    expect(h.flags.raised).toHaveLength(0);
    expect(h.audit.entries.some((e) => e.action === "flag.raised")).toBe(false);
  });

  it("raises a flag and marks the evidence when something is found", async () => {
    const conversation = await activeConversation(h);
    const evidence = h.messages.rows[0]!.id;
    h.judge.willReturn(
      verdict({
        category: "spiritual_coercion",
        severity: "medium",
        subject: "volunteer",
        action: "flag_for_review",
        evidenceMessageIds: [evidence],
        confidence: 0.8,
      }),
    );

    await h.service.reviewIfDue(conversation.id);

    expect(h.flags.raised).toHaveLength(1);
    expect(h.flags.raised[0]?.verdict.category).toBe("spiritual_coercion");
    expect((await h.messages.findById(evidence))?.flagged).toBe(true);
  });

  it("holds a serious conversation open for review, exempting it from purge", async () => {
    const conversation = await activeConversation(h);
    h.judge.willReturn(
      verdict({ severity: "high", action: "flag_for_review", confidence: 0.9 }),
    );

    await h.service.reviewIfDue(conversation.id);

    const after = await h.conversations.findById(conversation.id);
    expect(after?.status).toBe("under_review");
    // Null retention is what keeps the purge away from it.
    expect(after?.retainUntil).toBeNull();
  });

  it("leaves a low-severity conversation purgeable", async () => {
    const conversation = await activeConversation(h);
    h.judge.willReturn(
      verdict({ severity: "low", action: "flag_for_review", confidence: 0.8 }),
    );

    await h.service.reviewIfDue(conversation.id);

    const after = await h.conversations.findById(conversation.id);
    expect(after?.status).toBe("active");
    expect(after?.retainUntil).not.toBeNull();
  });

  it("ends the conversation on terminate, and says so in the room", async () => {
    const conversation = await activeConversation(h);
    h.judge.willReturn(
      verdict({
        category: "sexual_content",
        severity: "critical",
        action: "terminate",
        confidence: 0.95,
      }),
    );

    await h.service.reviewIfDue(conversation.id);

    expect((await h.conversations.findById(conversation.id))?.status).toBe("terminated");
    const notice = h.realtime.published.find((p) => p.event.type === "moderation_notice");
    expect(notice).toBeDefined();
  });

  it("alerts the volunteer on a crisis without ending the conversation", async () => {
    const conversation = await activeConversation(h);
    h.judge.willReturn(
      verdict({
        category: "self_harm_risk",
        severity: "critical",
        action: "escalate_crisis",
        confidence: 0.9,
      }),
    );

    await h.service.reviewIfDue(conversation.id);

    // Someone at risk must not have the conversation taken away from them.
    expect((await h.conversations.findById(conversation.id))?.status).toBe(
      "under_review",
    );
    const notice = h.realtime.published.find((p) => p.event.type === "moderation_notice");
    expect(notice).toBeDefined();
    if (notice?.event.type !== "moderation_notice") throw new Error("wrong event");
    expect(notice.event.text).toMatch(/at risk/i);
  });

  it("never reviews a conversation that has already ended", async () => {
    const conversation = await activeConversation(h);
    await h.conversations.end(conversation.id, "ended");

    expect(await h.service.reviewIfDue(conversation.id)).toBeNull();
    expect(h.judge.reviews).toHaveLength(0);
  });

  it("swallows a judge failure rather than surfacing it to the conversation", async () => {
    const conversation = await activeConversation(h);
    h.judge.review = async () => {
      throw new Error("model unavailable");
    };

    await expect(h.service.reviewIfDue(conversation.id)).resolves.toBeNull();
  });

  it("audits the flag with metadata, not conversation content", async () => {
    const conversation = await activeConversation(h);
    h.judge.willReturn(
      verdict({
        category: "financial_solicitation",
        severity: "high",
        subject: "volunteer",
        rationale: "The volunteer offered to send money.",
        action: "flag_for_review",
        confidence: 0.85,
      }),
    );

    await h.service.reviewIfDue(conversation.id);

    const entry = h.audit.entries.find((e) => e.action === "flag.raised");
    expect(entry?.detail.category).toBe("financial_solicitation");
    expect(entry?.detail.severity).toBe("high");
    // The rationale quotes the conversation, so it belongs in the encrypted
    // flag row, not in the audit log.
    expect(JSON.stringify(entry?.detail)).not.toContain("send money");
  });
});

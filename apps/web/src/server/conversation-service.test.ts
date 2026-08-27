import { beforeEach, describe, expect, it } from "vitest";
import { asSeekerId, asVolunteerId } from "@nexus/core";
import { FakeLlmProvider } from "@nexus/llm";
import { InMemoryTransport } from "@nexus/realtime";
import { LlmTranslator } from "@nexus/translation";
import { ConversationService } from "./conversation-service";
import type { Container } from "./container";
import {
  FakeAuditLog,
  FakeConversationRepository,
  FakeMessageRepository,
  fakeVolunteer,
} from "@/test/fakes";

/**
 * The vertical slice, end to end: a seeker arrives speaking one language, a
 * volunteer speaking another takes the conversation, and both read every
 * message in their own language.
 */
function harness() {
  const llm = new FakeLlmProvider();
  const conversations = new FakeConversationRepository();
  const messages = new FakeMessageRepository();
  const audit = new FakeAuditLog();
  const realtime = new InMemoryTransport();

  const container = {
    conversations,
    messages,
    audit,
    realtime,
    llm,
    translator: new LlmTranslator(llm),
  } as unknown as Container;

  return {
    llm,
    conversations,
    messages,
    audit,
    realtime,
    service: new ConversationService(container),
  };
}

/** Script the fake so any translation returns a recognisable marker. */
function scriptTranslation(llm: FakeLlmProvider, text: string, confidence = 0.95) {
  llm.on({
    task: "translation",
    value: { translation: text, confidence, glossaryHits: [] },
  });
}

describe("a seeker arriving", () => {
  let h: ReturnType<typeof harness>;
  beforeEach(() => {
    h = harness();
  });

  it("has a conversation and a room before answering any questions", async () => {
    const { conversation } = await h.service.startForSeeker(asSeekerId("skr_1"), "fa");

    expect(conversation.status).toBe("waiting");
    expect(conversation.seekerLanguage).toBe("fa");
    expect(conversation.volunteerId).toBeNull();
    expect(conversation.roomId).toBe(`nexus-${conversation.id}`);
  });

  it("sets a retention window so transcripts do not live forever", async () => {
    const { conversation } = await h.service.startForSeeker(asSeekerId("skr_1"), "fa");
    expect(conversation.retainUntil).not.toBeNull();
    expect(conversation.retainUntil!.getTime()).toBeGreaterThan(Date.now());
  });

  it("records the start in the audit log without storing any identity", async () => {
    await h.service.startForSeeker(asSeekerId("skr_1"), "fa");

    const entry = h.audit.entries.find((e) => e.action === "conversation.started");
    expect(entry).toBeDefined();
    expect(entry?.actorRole).toBe("seeker");
    // A seeker has no durable id to attribute the action to, by design.
    expect(entry?.actorId).toBeNull();
  });

  it("can speak before anyone has been matched", async () => {
    const { conversation } = await h.service.startForSeeker(asSeekerId("skr_1"), "fa");

    const { message } = await h.service.send({
      conversationId: conversation.id,
      authorRole: "seeker",
      authorId: null,
      text: "آیا خدا صدای من را می‌شنود؟",
      language: "fa",
    });

    // Nobody is reading yet, so there is nothing to translate into.
    expect(message.renderings).toHaveLength(1);
    expect(message.renderings[0]?.source).toBe("original");
    expect(h.llm.calls).toHaveLength(0);
  });
});

describe("matching a volunteer", () => {
  let h: ReturnType<typeof harness>;
  beforeEach(() => {
    h = harness();
  });

  it("marks translation as required when the two speak different languages", async () => {
    const { conversation } = await h.service.startForSeeker(asSeekerId("skr_1"), "fa");
    const claimed = await h.service.claimForVolunteer(conversation.id, fakeVolunteer());

    expect(claimed?.status).toBe("active");
    expect(claimed?.volunteerLanguage).toBe("en");
    expect(claimed?.translationRequired).toBe(true);
  });

  it("skips translation entirely when they share a language", async () => {
    const { conversation } = await h.service.startForSeeker(asSeekerId("skr_1"), "en");
    const claimed = await h.service.claimForVolunteer(conversation.id, fakeVolunteer());

    expect(claimed?.translationRequired).toBe(false);

    await h.service.send({
      conversationId: claimed!.id,
      authorRole: "seeker",
      authorId: null,
      text: "Does God hear me?",
      language: "en",
    });

    expect(h.llm.calls).toHaveLength(0);
  });

  it("lets exactly one of two simultaneous volunteers win", async () => {
    const { conversation } = await h.service.startForSeeker(asSeekerId("skr_1"), "fa");

    const [first, second] = await Promise.all([
      h.service.claimForVolunteer(conversation.id, fakeVolunteer()),
      h.service.claimForVolunteer(
        conversation.id,
        fakeVolunteer({ id: asVolunteerId("vol-2"), displayName: "Ben" }),
      ),
    ]);

    const winners = [first, second].filter(Boolean);
    expect(winners).toHaveLength(1);
  });

  it("translates what the seeker said while they were waiting", async () => {
    const { conversation } = await h.service.startForSeeker(asSeekerId("skr_1"), "fa");

    await h.service.send({
      conversationId: conversation.id,
      authorRole: "seeker",
      authorId: null,
      text: "آیا خدا صدای من را می‌شنود؟",
      language: "fa",
    });

    scriptTranslation(h.llm, "Does God hear me?");
    await h.service.claimForVolunteer(conversation.id, fakeVolunteer());

    // The backfilled English rendering is now durable, not recomputed on read.
    const stored = h.messages.rows[0];
    expect(stored?.renderings).toHaveLength(2);
    expect(stored?.renderings.find((r) => r.language === "en")?.text).toBe(
      "Does God hear me?",
    );
  });
});

describe("a translated conversation", () => {
  let h: ReturnType<typeof harness>;
  beforeEach(() => {
    h = harness();
  });

  async function matched() {
    const { conversation } = await h.service.startForSeeker(asSeekerId("skr_1"), "fa");
    return (await h.service.claimForVolunteer(conversation.id, fakeVolunteer()))!;
  }

  it("shows each side the message in their own language", async () => {
    const conversation = await matched();
    scriptTranslation(h.llm, "Does God hear me?");

    await h.service.send({
      conversationId: conversation.id,
      authorRole: "seeker",
      authorId: null,
      text: "آیا خدا صدای من را می‌شنود؟",
      language: "fa",
    });

    const forVolunteer = await h.service.transcriptFor(conversation.id, "en");
    expect(forVolunteer[0]?.text).toBe("Does God hear me?");
    expect(forVolunteer[0]?.wasTranslated).toBe(true);
    // The original always travels with it, so the volunteer can check.
    expect(forVolunteer[0]?.originalText).toBe("آیا خدا صدای من را می‌شنود؟");

    const forSeeker = await h.service.transcriptFor(conversation.id, "fa");
    expect(forSeeker[0]?.text).toBe("آیا خدا صدای من را می‌شنود؟");
    expect(forSeeker[0]?.wasTranslated).toBe(false);
  });

  it("translates the volunteer's reply back the other way", async () => {
    const conversation = await matched();
    scriptTranslation(h.llm, "بله، او می‌شنود.");

    await h.service.send({
      conversationId: conversation.id,
      authorRole: "volunteer",
      authorId: "vol-1",
      text: "Yes, he hears you.",
      language: "en",
    });

    const forSeeker = await h.service.transcriptFor(conversation.id, "fa");
    expect(forSeeker[0]?.text).toBe("بله، او می‌شنود.");
    expect(forSeeker[0]?.authorRole).toBe("volunteer");
  });

  it("delivers the message anyway when translation fails", async () => {
    const conversation = await matched();
    // No scripted translation, so the fake provider throws.

    const result = await h.service.send({
      conversationId: conversation.id,
      authorRole: "seeker",
      authorId: null,
      text: "آیا خدا صدای من را می‌شنود؟",
      language: "fa",
    });

    // Losing a translation must never lose the message.
    expect(result.translationDegraded).toBe(true);
    expect(result.message.renderings).toHaveLength(1);

    const forVolunteer = await h.service.transcriptFor(conversation.id, "en");
    expect(forVolunteer[0]?.text).toBe("آیا خدا صدای من را می‌شنود؟");
    // And the reader is told why they are looking at script they cannot read.
    expect(forVolunteer[0]?.translationUnavailable).toBe(true);
  });

  it("notifies the room after the message is durable, never before", async () => {
    const conversation = await matched();
    scriptTranslation(h.llm, "Does God hear me?");

    await h.service.send({
      conversationId: conversation.id,
      authorRole: "seeker",
      authorId: null,
      text: "سلام",
      language: "fa",
    });

    const published = h.realtime.published.filter((p) => p.event.type === "message");
    expect(published).toHaveLength(1);

    const event = published[0]?.event;
    if (event?.type !== "message") throw new Error("expected a message event");
    // The id in the event must resolve — a notification for a message that is
    // not yet readable produces a client that fetches and finds nothing.
    expect(await h.messages.findById(event.messageId as never)).not.toBeNull();
  });

  it("gives the translator the preceding turns as context", async () => {
    const conversation = await matched();
    scriptTranslation(h.llm, "anything");

    await h.service.send({
      conversationId: conversation.id,
      authorRole: "volunteer",
      authorId: "vol-1",
      text: "God raised Jesus from the dead.",
      language: "en",
    });
    await h.service.send({
      conversationId: conversation.id,
      authorRole: "volunteer",
      authorId: "vol-1",
      text: "Do you believe that?",
      language: "en",
    });

    const lastCall = h.llm.calls.at(-1);
    expect(lastCall?.messages[0]?.content).toContain("God raised Jesus from the dead.");
  });

  it("refuses to accept messages once the conversation has ended", async () => {
    const conversation = await matched();
    await h.conversations.end(conversation.id, "ended");

    await expect(
      h.service.send({
        conversationId: conversation.id,
        authorRole: "seeker",
        authorId: null,
        text: "hello?",
        language: "fa",
      }),
    ).rejects.toThrow(/has ended/);
  });
});

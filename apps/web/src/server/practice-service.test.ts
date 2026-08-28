import { beforeEach, describe, expect, it, vi } from "vitest";
import { asVolunteerId, original } from "@nexus/core";
import { InMemoryTransport } from "@nexus/realtime";
import type { Container } from "./container";
import { PracticeService } from "./practice-service";
import {
  FakeAuditLog,
  FakeConversationRepository,
  FakeMessageRepository,
  StubPracticePartner,
  fakeVolunteer,
} from "@/test/fakes";

function harness() {
  const conversations = new FakeConversationRepository();
  const messages = new FakeMessageRepository();
  const audit = new FakeAuditLog();
  const realtime = new InMemoryTransport();
  const practice = new StubPracticePartner();

  const container = {
    conversations,
    messages,
    audit,
    realtime,
    practice,
    // A practice conversation is in the seeker's language, so the normal send
    // path translates. Identity keeps the assertions about what was written.
    translator: {
      translate: async ({ text, target }: { text: string; target: string }) => ({
        text,
        language: target,
        source: "machine" as const,
      }),
      detectLanguage: async () => ({ language: "es", confidence: 1 }),
    },
  } as unknown as Container;

  return {
    conversations,
    messages,
    audit,
    realtime,
    practice,
    service: new PracticeService(container),
  };
}

const volunteer = fakeVolunteer({ id: asVolunteerId("vol-practice"), languages: ["en"] });

describe("PracticeService", () => {
  let h: ReturnType<typeof harness>;
  beforeEach(() => {
    h = harness();
  });

  describe("starting", () => {
    it("opens a conversation already matched to the volunteer running it", async () => {
      const conversation = await h.service.start(volunteer, "grief-mother");

      expect(conversation.status).toBe("active");
      expect(conversation.volunteerId).toBe(volunteer.id);
      expect(conversation.practiceScenario).toBe("grief-mother");
    });

    // The seeker's language, not the volunteer's. Feeling the translation
    // delay and reading a reply in a script you cannot scan is the product.
    it("runs in the scenario's language", async () => {
      const conversation = await h.service.start(volunteer, "grief-mother");
      expect(conversation.seekerLanguage).toBe("es");
      expect(conversation.translationRequired).toBe(true);
    });

    // A volunteer's first job is to respond to something they did not choose.
    it("lets the other person speak first", async () => {
      h.practice.willSay({ text: "no quiero rezar" });
      const conversation = await h.service.start(volunteer, "grief-mother");

      const transcript = await h.messages.listForConversation(conversation.id, {
        limit: 10,
      });
      expect(transcript).toHaveLength(1);
      expect(transcript[0]?.authorRole).toBe("seeker");
      expect(original(transcript[0]!).text).toBe("no quiero rezar");
    });

    it("keeps a rehearsal for weeks, not the ninety days a real one gets", async () => {
      const conversation = await h.service.start(volunteer, "grief-mother");
      const days =
        (conversation.retainUntil!.getTime() - Date.now()) / 86_400_000;
      expect(days).toBeLessThan(30);
    });

    it("refuses a scenario that does not exist", async () => {
      await expect(h.service.start(volunteer, "made-up")).rejects.toThrow(/not found/i);
    });
  });

  describe("responding", () => {
    it("answers the volunteer, seeing what they actually wrote", async () => {
      h.practice.willSay({ text: "primera" }, { text: "segunda" });
      const conversation = await h.service.start(volunteer, "grief-mother");

      await h.messages.append({
        conversationId: conversation.id,
        authorRole: "volunteer",
        authorId: volunteer.id,
        originalLanguage: "en",
        renderings: [{ language: "en", text: "Tell me about him.", source: "original" }],
      });

      await h.service.respond(conversation.id);

      const lastSeen = h.practice.seen.at(-1)!;
      expect(lastSeen.map((e) => e.text)).toEqual(["primera", "Tell me about him."]);
      const transcript = await h.messages.listForConversation(conversation.id, {
        limit: 10,
      });
      expect(original(transcript.at(-1)!).text).toBe("segunda");
    });

    // The whole reason the sandbox can live on the real surface: the judge
    // never runs here, so this is how the volunteer sees a crisis for real.
    it("raises the crisis card straight from the partner's own signal", async () => {
      h.practice.willSay({ text: "hola" }, { text: "no sé si estaré mañana", disclosesRisk: true });
      const conversation = await h.service.start(volunteer, "at-risk");

      expect((await h.conversations.findById(conversation.id))?.crisisRaisedAt).toBeNull();

      await h.service.respond(conversation.id);

      expect(
        (await h.conversations.findById(conversation.id))?.crisisRaisedAt,
      ).toBeInstanceOf(Date);
    });

    // A volunteer must not be trained to be reassured by a page that did not
    // happen. The notice says plainly that this is an exercise.
    it("tells the volunteer plainly that nobody was alerted", async () => {
      h.practice.willSay({ text: "hola" }, { text: "…", disclosesRisk: true });
      const conversation = await h.service.start(volunteer, "at-risk");
      await h.service.respond(conversation.id);

      const notice = h.realtime.published.find(
        (p) => p.event.type === "moderation_notice",
      );
      if (notice?.event.type !== "moderation_notice") throw new Error("no notice");
      expect(notice.event.text).toMatch(/this is practice/i);
      expect(notice.event.text).toMatch(/nobody has been alerted/i);
    });

    it("ends the session when the person has said what they came to say", async () => {
      h.practice.willSay({ text: "hola" }, { text: "me voy", ends: true });
      const conversation = await h.service.start(volunteer, "grief-mother");

      await h.service.respond(conversation.id);

      expect((await h.conversations.findById(conversation.id))?.status).toBe("ended");
    });

    // Leaves the volunteer with an unanswered message — which happens in real
    // conversations — rather than an error.
    it("swallows a partner failure", async () => {
      const conversation = await h.service.start(volunteer, "grief-mother");
      vi.spyOn(console, "error").mockImplementation(() => {});
      h.practice.willFail();

      await expect(h.service.respond(conversation.id)).resolves.toBeUndefined();
    });

    it("does nothing for a conversation that is not practice", async () => {
      const real = await h.conversations.create({
        seekerId: "skr_1" as never,
        seekerLanguage: "es",
        modality: "text",
        retainUntil: new Date(Date.now() + 86_400_000),
      });

      await h.service.respond(real.id);
      expect(h.practice.seen).toHaveLength(0);
    });
  });

  describe("the debrief", () => {
    async function started() {
      h.practice.willSay({ text: "no quiero rezar" });
      const conversation = await h.service.start(volunteer, "grief-mother");
      await h.messages.append({
        conversationId: conversation.id,
        authorRole: "volunteer",
        authorId: volunteer.id,
        originalLanguage: "en",
        renderings: [{ language: "en", text: "I'm here.", source: "original" }],
      });
      return conversation;
    }

    it("is written in the volunteer's own language", async () => {
      const conversation = await started();
      await h.service.debrief(conversation.id, volunteer);
      expect(h.practice.debriefedIn).toEqual(["en"]);
    });

    it("ends the session", async () => {
      const conversation = await started();
      await h.service.debrief(conversation.id, volunteer);
      expect((await h.conversations.findById(conversation.id))?.status).toBe("ended");
    });

    it("refuses when the volunteer has not said anything yet", async () => {
      h.practice.willSay({ text: "no quiero rezar" });
      const conversation = await h.service.start(volunteer, "grief-mother");

      await expect(h.service.debrief(conversation.id, volunteer)).rejects.toThrow(
        /say something first/i,
      );
    });

    it("will not hand one volunteer another's session", async () => {
      const conversation = await started();
      const other = fakeVolunteer({ id: asVolunteerId("vol-other") });

      await expect(h.service.debrief(conversation.id, other)).rejects.toThrow(
        /not your practice session/i,
      );
    });

    // Keeping a standing file of assessments of volunteers is a different and
    // far more sensitive thing than running a training exercise. The band is
    // recorded so a ministry can see practice is happening; the notes are not.
    it("records the readiness band and none of the notes", async () => {
      const conversation = await started();
      await h.service.debrief(conversation.id, volunteer);

      const entry = h.audit.entries.find((e) => e.action === "practice.debriefed");
      expect(entry?.detail).toEqual({
        scenario: "grief-mother",
        readiness: "with_support",
      });
    });
  });
});

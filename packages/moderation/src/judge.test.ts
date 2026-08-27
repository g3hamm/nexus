import { describe, expect, it } from "vitest";
import type { ConversationWindow, Message, ParticipantRole } from "@nexus/core";
import { asConversationId, asMessageId } from "@nexus/core";
import { FakeLlmProvider } from "@nexus/llm";
import { LlmJudge } from "./judge.js";
import { CadenceModerationScheduler } from "./scheduler.js";
import { buildJudgePrompt } from "./prompts.js";

let seq = 0;

function message(
  role: ParticipantRole,
  text: string,
  options: { english?: string; language?: string } = {},
): Message {
  const language = options.language ?? "en";
  return {
    id: asMessageId(`msg-${++seq}`),
    conversationId: asConversationId("conv-1"),
    authorRole: role,
    authorId: role === "seeker" ? null : "vol-1",
    originalLanguage: language,
    renderings: [
      { language, text, source: "original" as const },
      ...(options.english
        ? [{ language: "en", text: options.english, source: "machine" as const }]
        : []),
    ],
    sentAt: new Date(),
    flagged: false,
  };
}

function windowOf(...messages: Message[]): ConversationWindow {
  return {
    conversationId: asConversationId("conv-1"),
    messages,
    volunteerLanguage: "en",
    seekerLanguage: "fa",
  };
}

const verdict = (over: Partial<Record<string, unknown>> = {}) => ({
  category: "harassment_or_hate",
  severity: "medium",
  subject: "seeker",
  rationale: "Something concerning.",
  action: "flag_for_review",
  evidenceMessageIds: [],
  confidence: 0.9,
  ...over,
});

describe("LlmJudge", () => {
  it("returns a clean verdict for an empty window without calling the model", async () => {
    const llm = new FakeLlmProvider();
    const result = await new LlmJudge(llm).review(windowOf());

    expect(result.severity).toBe("none");
    expect(result.action).toBe("none");
    // Asking about nothing invites the model to invent a concern.
    expect(llm.calls).toHaveLength(0);
  });

  it("shows the judge both the original text and its English rendering", async () => {
    const llm = new FakeLlmProvider().on({ task: "moderation", value: verdict() });
    const judge = new LlmJudge(llm);

    await judge.review(
      windowOf(
        message("seeker", "آیا خدا صدای من را می‌شنود؟", {
          language: "fa",
          english: "Does God hear me?",
        }),
      ),
    );

    const sent = llm.calls[0]?.messages[0]?.content ?? "";
    expect(sent).toContain("آیا خدا صدای من را می‌شنود؟");
    expect(sent).toContain("Does God hear me?");
  });

  it("never recommends terminating for self-harm risk", async () => {
    const llm = new FakeLlmProvider().on({
      task: "moderation",
      value: verdict({
        category: "self_harm_risk",
        severity: "critical",
        action: "terminate",
        confidence: 0.95,
      }),
    });

    const result = await new LlmJudge(llm).review(
      windowOf(message("seeker", "I don't want to be here anymore")),
    );

    // Someone in crisis is the reason this platform exists, not a rule-breaker.
    expect(result.action).toBe("escalate_crisis");
    expect(result.severity).toBe("critical");
  });

  it("downgrades unilateral action when the model is not confident", async () => {
    const llm = new FakeLlmProvider().on({
      task: "moderation",
      value: verdict({ action: "terminate", confidence: 0.4 }),
    });

    const result = await new LlmJudge(llm).review(
      windowOf(message("seeker", "something ambiguous")),
    );

    expect(result.action).toBe("flag_for_review");
  });

  it("downgrades a hesitant crisis escalation too", async () => {
    const llm = new FakeLlmProvider().on({
      task: "moderation",
      value: verdict({ action: "escalate_crisis", confidence: 0.5 }),
    });

    const result = await new LlmJudge(llm).review(
      windowOf(message("seeker", "ambiguous")),
    );

    expect(result.action).toBe("flag_for_review");
  });

  it("keeps confident action intact", async () => {
    const llm = new FakeLlmProvider().on({
      task: "moderation",
      value: verdict({ action: "terminate", confidence: 0.95 }),
    });

    const result = await new LlmJudge(llm).review(
      windowOf(message("volunteer", "explicit abuse")),
    );

    expect(result.action).toBe("terminate");
  });

  it("discards evidence ids that were not in the window", async () => {
    const real = message("seeker", "hello");
    const llm = new FakeLlmProvider().on({
      task: "moderation",
      value: verdict({ evidenceMessageIds: [real.id, "msg-does-not-exist"] }),
    });

    const result = await new LlmJudge(llm).review(windowOf(real));

    // A hallucinated id makes a flag unreviewable.
    expect(result.evidenceMessageIds).toEqual([real.id]);
  });

  it("bounds how much conversation it sends", async () => {
    const llm = new FakeLlmProvider().on({ task: "moderation", value: verdict() });
    const judge = new LlmJudge(llm, { windowSize: 3 });

    const messages = Array.from({ length: 10 }, (_, i) => message("seeker", `line ${i}`));
    await judge.review(windowOf(...messages));

    const sent = llm.calls[0]?.messages[0]?.content ?? "";
    expect(sent).toContain("line 9");
    expect(sent).not.toContain("line 5");
  });
});

describe("the judge prompt", () => {
  it("is byte-identical across builds so the cache can hit", () => {
    expect(buildJudgePrompt()).toBe(buildJudgePrompt());
  });

  it("tells the judge to watch volunteers, not only seekers", () => {
    const prompt = buildJudgePrompt();
    expect(prompt).toMatch(/volunteer-side category/i);
    expect(prompt).toMatch(/spiritual_coercion/);
  });

  it("frames self-harm as care rather than violation", () => {
    expect(buildJudgePrompt()).toMatch(/never a violation|care, never punishment/i);
  });

  it("says anger and doubt are not violations", () => {
    expect(buildJudgePrompt()).toMatch(/Anger, doubt, blasphemy/);
  });
});

describe("CadenceModerationScheduler", () => {
  const scheduler = new CadenceModerationScheduler();

  it("does not review an empty conversation", () => {
    expect(scheduler.shouldReview(windowOf(), null)).toBe(false);
  });

  it("waits for a real exchange before the first review", () => {
    expect(scheduler.shouldReview(windowOf(message("seeker", "hi")), null)).toBe(false);
    expect(
      scheduler.shouldReview(
        windowOf(message("seeker", "hi"), message("volunteer", "hello")),
        null,
      ),
    ).toBe(true);
  });

  it("reviews immediately on crisis language, whatever the cadence says", () => {
    const w = windowOf(message("seeker", "honestly I want to die"));
    expect(scheduler.shouldReview(w, new Date())).toBe(true);
  });

  it("catches crisis language through the English translation", () => {
    // The seeker wrote Farsi; the tripwire reads the rendering the translation
    // layer already produced.
    const w = windowOf(
      message("seeker", "دیگر نمی‌خواهم زنده بمانم", {
        language: "fa",
        english: "I don't want to live anymore, I want to die",
      }),
    );
    expect(scheduler.shouldReview(w, new Date())).toBe(true);
  });

  it("reviews immediately when someone tries to move off-platform", () => {
    const w = windowOf(message("volunteer", "just message me on WhatsApp"));
    expect(scheduler.shouldReview(w, new Date())).toBe(true);
  });

  it("reviews immediately on money talk", () => {
    const w = windowOf(message("volunteer", "I could send money to help you"));
    expect(scheduler.shouldReview(w, new Date())).toBe(true);
  });

  it("otherwise waits for the message cadence", () => {
    const recent = new Date();
    const five = Array.from({ length: 5 }, () => message("seeker", "ordinary talk"));
    expect(scheduler.shouldReview(windowOf(...five), recent)).toBe(false);

    const six = Array.from({ length: 6 }, () => message("seeker", "ordinary talk"));
    expect(scheduler.shouldReview(windowOf(...six), recent)).toBe(true);
  });

  it("reviews on elapsed time even in a slow conversation", () => {
    const w = windowOf(message("seeker", "ordinary"), message("volunteer", "ordinary"));
    const longAgo = new Date(Date.now() - 10 * 60_000);
    expect(scheduler.shouldReview(w, longAgo)).toBe(true);
  });

  it("does not treat ordinary hard questions as urgent", () => {
    const w = windowOf(
      message("seeker", "Why would a good God allow my mother to suffer?"),
    );
    expect(scheduler.shouldReview(w, new Date())).toBe(false);
  });
});

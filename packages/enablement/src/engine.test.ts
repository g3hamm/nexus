import { describe, expect, it } from "vitest";
import type {
  ConversationWindow,
  KnowledgeBase,
  Message,
  ParticipantRole,
  RetrievedChunk,
} from "@nexus/core";
import { asChunkId, asConversationId, asDocumentId, asMessageId } from "@nexus/core";
import { FakeLlmProvider } from "@nexus/llm";
import { LlmEnablementEngine } from "./engine.js";
import { buildEnablementPrompt } from "./prompts.js";

let seq = 0;

function message(role: ParticipantRole, text: string, english?: string): Message {
  const language = english ? "es" : "en";
  return {
    id: asMessageId(`msg-${++seq}`),
    conversationId: asConversationId("conv-1"),
    authorRole: role,
    authorId: role === "seeker" ? null : "vol-1",
    originalLanguage: language,
    renderings: [
      { language, text, source: "original" as const },
      ...(english ? [{ language: "en", text: english, source: "machine" as const }] : []),
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
    seekerLanguage: "es",
  };
}

function chunk(title: string, text: string): RetrievedChunk {
  return {
    chunk: {
      id: asChunkId(`chunk-${title}`),
      documentId: asDocumentId("doc-1"),
      title,
      source: "Some Author, Some Book",
      kind: "apologetics",
      text,
      language: "en",
    },
    score: 0.72,
  };
}

class StubKnowledge implements KnowledgeBase {
  readonly name = "stub";
  readonly queries: string[] = [];
  constructor(private readonly results: RetrievedChunk[] = []) {}
  async search(query: { text: string }): Promise<readonly RetrievedChunk[]> {
    this.queries.push(query.text);
    return this.results;
  }
  async upsert(): Promise<void> {}
  async remove(): Promise<void> {}
}

class BrokenKnowledge implements KnowledgeBase {
  readonly name = "broken";
  async search(): Promise<readonly RetrievedChunk[]> {
    throw new Error("knowledge base unavailable");
  }
  async upsert(): Promise<void> {}
  async remove(): Promise<void> {}
}

const suggestions = {
  verses: [
    {
      book: "Ps",
      chapter: 13,
      verse: 1,
      endVerse: 2,
      rationale: "She says God stopped listening; this is a psalm of that complaint.",
    },
  ],
  discussionPoints: [
    { text: "Ask how long she has felt unheard.", intent: "question" as const },
    { text: "Do not tell her this was God's plan.", intent: "caution" as const },
  ],
  understanding: {
    summary: "Grieving, and angry at God rather than uninterested in him.",
    apparentNeed: "To be taken seriously rather than answered.",
    cautions: ["Avoid apologetics while she is this raw."],
    confidence: 0.6,
  },
};

describe("LlmEnablementEngine", () => {
  it("returns nothing for an empty conversation without calling anything", async () => {
    const llm = new FakeLlmProvider();
    const knowledge = new StubKnowledge();

    const result = await new LlmEnablementEngine(llm, knowledge).suggest(windowOf());

    expect(result.verses).toHaveLength(0);
    expect(result.discussionPoints).toHaveLength(0);
    expect(llm.calls).toHaveLength(0);
    expect(knowledge.queries).toHaveLength(0);
  });

  it("retrieves on what the seeker said, not on the volunteer's replies", async () => {
    const llm = new FakeLlmProvider().on({ task: "enablement", value: suggestions });
    const knowledge = new StubKnowledge();

    await new LlmEnablementEngine(llm, knowledge).suggest(
      windowOf(
        message("volunteer", "Tell me what happened."),
        message(
          "seeker",
          "Mi hijo murió y Dios no escuchó",
          "My son died and God did not listen",
        ),
      ),
    );

    expect(knowledge.queries).toHaveLength(1);
    expect(knowledge.queries[0]).toContain("My son died");
    expect(knowledge.queries[0]).not.toContain("Tell me what happened");
  });

  it("reads the conversation in the volunteer's language", async () => {
    const llm = new FakeLlmProvider().on({ task: "enablement", value: suggestions });

    await new LlmEnablementEngine(llm, new StubKnowledge()).suggest(
      windowOf(message("seeker", "Mi hijo murió", "My son died")),
    );

    const sent = llm.calls[0]?.messages[0]?.content ?? "";
    expect(sent).toContain("My son died");
    expect(sent).not.toContain("Mi hijo murió");
  });

  it("passes retrieved passages to the model and returns them for citation", async () => {
    const source = chunk(
      "Lament in the Psalms",
      "The psalms of lament are prayers of protest.",
    );
    const llm = new FakeLlmProvider().on({ task: "enablement", value: suggestions });

    const result = await new LlmEnablementEngine(
      llm,
      new StubKnowledge([source]),
    ).suggest(windowOf(message("seeker", "God does not listen")));

    const sent = llm.calls[0]?.messages[0]?.content ?? "";
    expect(sent).toContain("prayers of protest");
    expect(sent).toContain("Lament in the Psalms");
    // The panel must be able to show where a suggestion came from.
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]?.chunk.source).toBe("Some Author, Some Book");
  });

  it("tells the model to say less when nothing was retrieved", async () => {
    const llm = new FakeLlmProvider().on({ task: "enablement", value: suggestions });

    await new LlmEnablementEngine(llm, new StubKnowledge([])).suggest(
      windowOf(message("seeker", "an obscure question")),
    );

    expect(llm.calls[0]?.messages[0]?.content).toMatch(/prefer saying less/);
  });

  it("still produces a panel when the knowledge base is down", async () => {
    const llm = new FakeLlmProvider().on({ task: "enablement", value: suggestions });

    const result = await new LlmEnablementEngine(llm, new BrokenKnowledge()).suggest(
      windowOf(message("seeker", "God does not listen")),
    );

    // Degraded, not absent.
    expect(result.discussionPoints).toHaveLength(2);
    expect(result.sources).toHaveLength(0);
  });

  it("carries the rationale through, since that is what makes a verse usable", async () => {
    const llm = new FakeLlmProvider().on({ task: "enablement", value: suggestions });

    const result = await new LlmEnablementEngine(llm, new StubKnowledge()).suggest(
      windowOf(message("seeker", "God does not listen")),
    );

    expect(result.verses[0]?.rationale).toContain("psalm of that complaint");
    expect(result.verses[0]?.reference.book).toBe("Ps");
    // No bible provider wired, so no preview — and that is not an error.
    expect(result.verses[0]?.preview).toBeNull();
  });

  it("keeps cautions, which are often the most useful thing on the panel", async () => {
    const llm = new FakeLlmProvider().on({ task: "enablement", value: suggestions });

    const result = await new LlmEnablementEngine(llm, new StubKnowledge()).suggest(
      windowOf(message("seeker", "God does not listen")),
    );

    const caution = result.discussionPoints.find((p) => p.intent === "caution");
    expect(caution?.text).toContain("God's plan");
  });

  it("bounds how much conversation it considers", async () => {
    const llm = new FakeLlmProvider().on({ task: "enablement", value: suggestions });
    const engine = new LlmEnablementEngine(llm, new StubKnowledge(), {
      windowSize: 2,
    });

    await engine.suggest(
      windowOf(
        message("seeker", "very old line"),
        message("seeker", "middle line"),
        message("seeker", "newest line"),
      ),
    );

    const sent = llm.calls[0]?.messages[0]?.content ?? "";
    expect(sent).toContain("newest line");
    expect(sent).not.toContain("very old line");
  });
});

describe("the enablement prompt", () => {
  it("is byte-identical across builds so the cache can hit", () => {
    expect(buildEnablementPrompt()).toBe(buildEnablementPrompt());
  });

  it("forbids drafting messages for the volunteer", () => {
    expect(buildEnablementPrompt()).toMatch(/Never draft a message/);
  });

  it("forbids pressure and material inducements", () => {
    const prompt = buildEnablementPrompt();
    expect(prompt).toMatch(/Never suggest pressuring/);
    expect(prompt).toMatch(/immigration help/);
  });

  it("puts care before apologetics when someone is in crisis", () => {
    expect(buildEnablementPrompt()).toMatch(/stop suggesting apologetics/);
  });

  it("carries the doctrine profile", () => {
    expect(buildEnablementPrompt()).toMatch(/Historic Creedal Christianity/);
  });
});

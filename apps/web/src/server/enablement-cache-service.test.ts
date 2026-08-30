import { beforeEach, describe, expect, it } from "vitest";
import { asConversationId, asSeekerId } from "@nexus/core";
import type { Container } from "./container";
import { EnablementCacheService } from "./enablement-cache-service";
import {
  FakeConversationRepository,
  FakeEnablementCacheRepository,
  FakeMessageRepository,
  StubEnablementEngine,
  fakeVolunteer,
} from "@/test/fakes";

function harness() {
  const conversations = new FakeConversationRepository();
  const messages = new FakeMessageRepository();
  const enablement = new StubEnablementEngine();
  const enablementCache = new FakeEnablementCacheRepository();

  const container = {
    conversations,
    messages,
    enablement,
    enablementCache,
  } as unknown as Container;

  return {
    conversations,
    messages,
    enablement,
    enablementCache,
    service: new EnablementCacheService(container),
  };
}

async function matchedConversation(h: ReturnType<typeof harness>) {
  const conversation = await h.conversations.create({
    seekerId: asSeekerId("skr_1"),
    seekerLanguage: "fa",
    modality: "text",
    retainUntil: new Date(Date.now() + 90 * 86_400_000),
  });
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

describe("EnablementCacheService.getSuggestions", () => {
  let h: ReturnType<typeof harness>;
  beforeEach(() => {
    h = harness();
  });

  it("returns not-ready for an empty conversation without calling the engine", async () => {
    const conversation = await h.conversations.create({
      seekerId: asSeekerId("skr_2"),
      seekerLanguage: "en",
      modality: "text",
      retainUntil: new Date(Date.now() + 90 * 86_400_000),
    });

    const result = await h.service.getSuggestions(conversation.id);

    expect(result.ready).toBe(false);
    expect(h.enablement.suggestCalls).toHaveLength(0);
  });

  it("bootstraps the full tier on the first call", async () => {
    const conversation = await matchedConversation(h);
    h.enablement.willSuggest({
      discussionPoints: [{ text: "Ask what happened.", intent: "question" }],
    });

    const result = await h.service.getSuggestions(conversation.id);

    expect(result.ready).toBe(true);
    expect(h.enablement.suggestCalls).toHaveLength(1);
    expect(result.discussionPoints[0]?.text).toBe("Ask what happened.");

    const cached = await h.enablementCache.find(conversation.id);
    expect(cached.full).not.toBeNull();
  });

  it("prefers the cache on a second call, never calling the engine again", async () => {
    const conversation = await matchedConversation(h);
    await h.service.getSuggestions(conversation.id);
    await h.service.getSuggestions(conversation.id);

    expect(h.enablement.suggestCalls).toHaveLength(1);
  });

  it("regenerates when forceRefresh is asked for, even with an existing cache", async () => {
    const conversation = await matchedConversation(h);
    await h.service.getSuggestions(conversation.id);

    await h.service.getSuggestions(conversation.id, { forceRefresh: true });

    expect(h.enablement.suggestCalls).toHaveLength(2);
  });

  it("shows the freshest verses, not always the full tier's own bundled ones", async () => {
    const conversation = await matchedConversation(h);
    h.enablement.willSuggest({
      verses: [
        {
          reference: { book: "Jn", chapter: 3, verse: 16, endVerse: null },
          rationale: "old",
          preview: null,
        },
      ],
    });
    await h.service.getSuggestions(conversation.id);

    // A background verses refresh lands after the full tier was generated.
    await h.enablementCache.writeVerses(
      conversation.id,
      [
        {
          reference: { book: "Ps", chapter: 23, verse: 1, endVerse: null },
          rationale: "new",
          preview: null,
        },
      ],
      new Date(Date.now() + 1000),
      1,
    );

    const result = await h.service.getSuggestions(conversation.id);

    expect(result.verses[0]?.rationale).toBe("new");
  });

  it("a forced full refresh's own verses win immediately after it runs", async () => {
    const conversation = await matchedConversation(h);
    // A verses refresh happened first, before the volunteer ever opened the panel.
    await h.enablementCache.writeVerses(
      conversation.id,
      [
        {
          reference: { book: "Ps", chapter: 23, verse: 1, endVerse: null },
          rationale: "earlier",
          preview: null,
        },
      ],
      new Date(Date.now() - 1000),
      1,
    );
    h.enablement.willSuggest({
      verses: [
        {
          reference: { book: "Jn", chapter: 3, verse: 16, endVerse: null },
          rationale: "fresh bootstrap",
          preview: null,
        },
      ],
    });

    const result = await h.service.getSuggestions(conversation.id);

    expect(result.verses[0]?.rationale).toBe("fresh bootstrap");
  });
});

describe("EnablementCacheService.refreshVerses", () => {
  let h: ReturnType<typeof harness>;
  beforeEach(() => {
    h = harness();
  });

  it("generates and persists verses for an active conversation", async () => {
    const conversation = await matchedConversation(h);
    h.enablement.willSuggestVerses([
      {
        reference: { book: "Ps", chapter: 13, verse: 1, endVerse: null },
        rationale: "fits",
        preview: null,
      },
    ]);

    await h.service.refreshVerses(conversation.id);

    expect(h.enablement.suggestVersesCalls).toHaveLength(1);
    const cached = await h.enablementCache.find(conversation.id);
    expect(cached.verses?.verses[0]?.rationale).toBe("fits");
  });

  it("does nothing for a conversation that has already ended", async () => {
    const conversation = await matchedConversation(h);
    await h.conversations.end(conversation.id, "ended");

    await h.service.refreshVerses(conversation.id);

    expect(h.enablement.suggestVersesCalls).toHaveLength(0);
  });

  it("does nothing for a conversation with no messages yet", async () => {
    const conversation = await h.conversations.create({
      seekerId: asSeekerId("skr_3"),
      seekerLanguage: "en",
      modality: "text",
      retainUntil: new Date(Date.now() + 90 * 86_400_000),
    });

    await h.service.refreshVerses(conversation.id);

    expect(h.enablement.suggestVersesCalls).toHaveLength(0);
  });

  it("does nothing for a conversation that does not exist", async () => {
    await expect(
      h.service.refreshVerses(asConversationId("conv-missing")),
    ).resolves.toBeUndefined();
    expect(h.enablement.suggestVersesCalls).toHaveLength(0);
  });

  it("swallows an engine failure rather than throwing into after()", async () => {
    const conversation = await matchedConversation(h);
    h.enablement.suggestVerses = async () => {
      throw new Error("model unavailable");
    };

    await expect(h.service.refreshVerses(conversation.id)).resolves.toBeUndefined();
  });
});

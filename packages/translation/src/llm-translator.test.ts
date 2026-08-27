import { describe, expect, it } from "vitest";
import { FakeLlmProvider } from "@nexus/llm";
import { CHRISTIAN_GLOSSARY, CHRISTIAN_GLOSSARY_ENTRIES } from "./glossary.js";
import { LlmTranslator } from "./llm-translator.js";
import { buildTranslationSystemPrompt } from "./prompts.js";

function translator() {
  const llm = new FakeLlmProvider();
  return { llm, subject: new LlmTranslator(llm) };
}

describe("LlmTranslator", () => {
  it("never calls the model when both sides share a language", async () => {
    const { llm, subject } = translator();

    const result = await subject.translate({
      text: "Does God actually hear me?",
      from: "en",
      to: "en",
    });

    expect(result.text).toBe("Does God actually hear me?");
    expect(result.engine).toBe("passthrough");
    expect(llm.calls).toHaveLength(0);
  });

  it("treats regional variants as the same language", async () => {
    const { llm, subject } = translator();

    await subject.translate({ text: "Olá", from: "pt-BR", to: "pt" });

    expect(llm.calls).toHaveLength(0);
  });

  it("translates across languages and reports glossary hits", async () => {
    const { llm, subject } = translator();
    llm.on({
      task: "translation",
      value: {
        translation: "La gracia de Dios es un regalo.",
        confidence: 0.94,
        glossaryHits: [
          { sourceTerm: "grace", renderedAs: "gracia", note: "God's unearned favour" },
        ],
      },
    });

    const result = await subject.translate({
      text: "The grace of God is a gift.",
      from: "en",
      to: "es",
    });

    expect(result.text).toBe("La gracia de Dios es un regalo.");
    expect(result.confidence).toBeCloseTo(0.94);
    expect(result.glossaryHits[0]?.renderedAs).toBe("gracia");
    expect(result.engine).toContain("fake");
  });

  it("passes preceding turns as context so pronouns resolve", async () => {
    const { llm, subject } = translator();
    llm.on({
      task: "translation",
      value: { translation: "¿Crees eso?", confidence: 0.9, glossaryHits: [] },
    });

    await subject.translate({
      text: "Do you believe that?",
      from: "en",
      to: "es",
      context: ["God raised Jesus from the dead.", "That is the claim."],
    });

    const sent = llm.calls[0]?.messages[0]?.content ?? "";
    expect(sent).toContain("God raised Jesus from the dead.");
    expect(sent).toContain("Do you believe that?");
  });

  it("detects the language of romanised text", async () => {
    const { llm, subject } = translator();
    llm.on({
      task: "language_detection",
      value: { language: "fa", confidence: 0.82 },
    });

    const result = await subject.detectLanguage("salam, khoobi?");

    expect(result.language).toBe("fa");
    expect(result.confidence).toBeCloseTo(0.82);
  });
});

describe("Christian glossary", () => {
  it("matches terms on word boundaries, not substrings", () => {
    const hits = CHRISTIAN_GLOSSARY.match("I am sincere but I have no faith.");
    const terms = hits.map((h) => h.term);

    expect(terms).toContain("faith");
    // "sincere" contains "sin" — it must not trip the entry for sin.
    expect(terms).not.toContain("sin");
  });

  it("carries the two mistranslations that break conversations", () => {
    const terms = CHRISTIAN_GLOSSARY_ENTRIES.map((e) => e.term);
    expect(terms).toContain("born again");
    expect(terms).toContain("Son of God");

    const bornAgain = CHRISTIAN_GLOSSARY_ENTRIES.find((e) => e.term === "born again");
    expect(bornAgain?.avoid).toMatch(/reincarnation/i);

    const sonOfGod = CHRISTIAN_GLOSSARY_ENTRIES.find((e) => e.term === "Son of God");
    expect(sonOfGod?.avoid).toMatch(/biologically/i);
  });

  it("gives every entry a Christian sense to translate toward", () => {
    for (const entry of CHRISTIAN_GLOSSARY_ENTRIES) {
      expect(entry.christianSense.length).toBeGreaterThan(20);
    }
  });
});

describe("translation system prompt", () => {
  it("is byte-identical across builds so the prompt cache can hit", () => {
    expect(buildTranslationSystemPrompt(CHRISTIAN_GLOSSARY)).toBe(
      buildTranslationSystemPrompt(CHRISTIAN_GLOSSARY),
    );
  });

  it("carries the whole glossary, not a per-message subset", () => {
    const prompt = buildTranslationSystemPrompt(CHRISTIAN_GLOSSARY);
    for (const entry of CHRISTIAN_GLOSSARY_ENTRIES) {
      expect(prompt).toContain(entry.term);
    }
  });

  it("tells the model to preserve tone rather than soften it", () => {
    const prompt = buildTranslationSystemPrompt(CHRISTIAN_GLOSSARY);
    expect(prompt).toMatch(/angry, blunt, sarcastic, crude, or grieving/);
  });
});

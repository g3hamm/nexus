import { describe, expect, it } from "vitest";
import { practiceDebriefSchema, practiceTurnSchema } from "@nexus/core";
import { MESSAGES_FOR_TESTS } from "./partner.js";
import { buildDebriefPrompt, buildPartnerPrompt, formatExchanges } from "./prompts.js";
import { PRACTICE_SCENARIOS, findScenario, scenarioIds } from "./scenarios.js";

describe("scenario catalogue", () => {
  it("has ids that are unique and url-safe", () => {
    const ids = scenarioIds();
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it.each(PRACTICE_SCENARIOS)("$id is fully specified", (scenario) => {
    expect(scenario.title.trim().length).toBeGreaterThan(0);
    expect(scenario.premise.trim().length).toBeGreaterThan(0);
    expect(scenario.competencies.length).toBeGreaterThan(0);
    // A persona is the whole craft here. A thin one produces a partner that
    // is agreeable within three turns, which teaches the volunteer nothing.
    expect(scenario.persona.length).toBeGreaterThan(400);
  });

  // A volunteer who has only practised in their own language has not
  // practised this product. One English scenario exists on purpose, to work
  // on the interpersonal part with the translation friction removed.
  it("is almost entirely not in English", () => {
    const english = PRACTICE_SCENARIOS.filter((s) => s.language.startsWith("en"));
    expect(english).toHaveLength(1);
  });

  it("covers the full range of difficulty", () => {
    const difficulties = new Set(PRACTICE_SCENARIOS.map((s) => s.difficulty));
    expect(difficulties).toEqual(new Set(["searching", "sceptical", "hostile"]));
  });

  it("includes right-to-left languages", () => {
    const rtl = PRACTICE_SCENARIOS.filter((s) => ["ar", "fa"].includes(s.language));
    expect(rtl.length).toBeGreaterThanOrEqual(2);
  });

  // Exactly one, and flagged. It has to exist — a volunteer should meet this
  // for the first time in practice — and it has to be findable, so the picker
  // can warn before somebody walks into it.
  it("marks the one scenario that reaches self-harm", () => {
    expect(PRACTICE_SCENARIOS.filter((s) => s.reachesCrisis)).toHaveLength(1);
  });

  it("finds a scenario by id, and nothing by a bad one", () => {
    expect(findScenario("grief-mother")?.title).toBeTruthy();
    expect(findScenario("no-such-scenario")).toBeNull();
  });
});

describe("partner prompt", () => {
  const scenario = PRACTICE_SCENARIOS[0]!;

  it("carries the persona and pins the language", () => {
    const prompt = buildPartnerPrompt(scenario);
    expect(prompt).toContain(scenario.persona);
    expect(prompt).toContain(scenario.language);
  });

  // The two instructions the whole exercise depends on. If the partner
  // softens or steps out of character, the volunteer is no longer practising.
  it("forbids softening and forbids breaking character", () => {
    const prompt = buildPartnerPrompt(scenario);
    expect(prompt).toMatch(/do not be moved easily/i);
    expect(prompt).toMatch(/stay in character completely/i);
  });

  it("rules out methods of self-harm and real organisations", () => {
    const prompt = buildPartnerPrompt(scenario);
    expect(prompt).toMatch(/never describe a method/i);
    expect(prompt).toMatch(/never name a real church, organisation/i);
  });
});

describe("debrief prompt", () => {
  const scenario = PRACTICE_SCENARIOS[0]!;

  it("names the competencies the scenario was built to test", () => {
    const prompt = buildDebriefPrompt(scenario, "en");
    for (const competency of scenario.competencies) {
      expect(prompt).toContain(competency);
    }
  });

  it("writes in the volunteer's own language", () => {
    expect(buildDebriefPrompt(scenario, "Português")).toContain("Português");
  });

  // Softening a harm into a growth point is how it gets skimmed past.
  it("keeps harms out of the growth list", () => {
    expect(buildDebriefPrompt(scenario, "en")).toMatch(/never softened into/i);
  });

  it("does not push the coach toward inventing findings", () => {
    const prompt = buildDebriefPrompt(scenario, "en");
    expect(prompt).toMatch(/empty .*harms.* list is the normal, expected result/i);
  });

  // An exercise started from an Academy module is marked against two things:
  // whether the conversation went well, and whether the reading landed. The
  // second is what makes a module a module rather than a page.
  it("marks against the module when the exercise came from one", () => {
    const prompt = buildDebriefPrompt(scenario, "en", {
      title: "When not to argue",
      summary: "Some of the best moves in this work look like losing.",
      teaches: ["Saying \"I don't know\" plainly rather than bluffing"],
    });

    expect(prompt).toContain("When not to argue");
    expect(prompt).toContain("Saying \"I don't know\" plainly rather than bluffing");
    // The scenario's own competencies are not displaced by the module's.
    for (const competency of scenario.competencies) expect(prompt).toContain(competency);
  });

  // Arriving from the practice list is a normal way to arrive, and the prompt
  // must not then talk about reading the volunteer never did.
  it("says nothing about a module when there was none", () => {
    expect(buildDebriefPrompt(scenario, "en")).not.toMatch(/What they had just read/);
  });
});

describe("transcript to model turns", () => {
  // The seeker is the assistant so the model continues its own side rather
  // than describing what someone else would say. The second framing drifts
  // into narration within a few turns.
  it("casts the simulated seeker as the assistant", () => {
    const messages = MESSAGES_FOR_TESTS([
      { role: "seeker", text: "no me hables de Dios" },
      { role: "volunteer", text: "I'm listening." },
    ]);

    expect(messages).toEqual([
      { role: "assistant", content: "no me hables de Dios" },
      { role: "user", content: "I'm listening." },
    ]);
  });

  it("gives an empty conversation something to open from", () => {
    const messages = MESSAGES_FOR_TESTS([]);
    expect(messages).toHaveLength(1);
    expect(messages[0]?.role).toBe("user");
  });

  // Providers refuse to produce an assistant turn after an assistant turn.
  it("appends a cue when the last word was the seeker's", () => {
    const messages = MESSAGES_FOR_TESTS([
      { role: "volunteer", text: "How are you?" },
      { role: "seeker", text: "..." },
    ]);
    expect(messages.at(-1)?.role).toBe("user");
  });
});

describe("formatting", () => {
  it("labels both sides", () => {
    const formatted = formatExchanges([
      { role: "seeker", text: "why" },
      { role: "volunteer", text: "I don't know" },
    ]);
    expect(formatted).toContain("THEM: why");
    expect(formatted).toContain("VOLUNTEER: I don't know");
  });

  it("says so when nothing was said", () => {
    expect(formatExchanges([])).toContain("empty");
  });
});

describe("schemas", () => {
  it("accepts a well-formed turn", () => {
    expect(
      practiceTurnSchema.parse({ text: "no", ends: false, disclosesRisk: false }),
    ).toBeTruthy();
  });

  it("rejects a turn with no text, which would render as an empty bubble", () => {
    expect(() =>
      practiceTurnSchema.parse({ text: "", ends: false, disclosesRisk: false }),
    ).toThrow();
  });

  it("accepts a debrief with a note that has no quote", () => {
    const debrief = practiceDebriefSchema.parse({
      summary: "You listened well.",
      strengths: [
        {
          point: "You asked about Diego",
          quote: "what was he like?",
          why: "It moved the conversation to him.",
        },
      ],
      growth: [],
      harms: [],
      missed: [
        {
          point: "You never asked whether she still prays",
          quote: null,
          why: "It was the question underneath.",
        },
      ],
      readiness: "with_support",
    });
    expect(debrief.missed[0]?.quote).toBeNull();
  });
});

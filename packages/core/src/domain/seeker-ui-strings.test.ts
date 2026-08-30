import { describe, expect, it } from "vitest";
import {
  SEEKER_UI_LANGUAGES,
  SEEKER_UI_STRINGS,
  seekerUiStringsFor,
} from "./seeker-ui-strings.js";
import { CRISIS_STRINGS } from "./crisis-strings.js";

describe("string table integrity", () => {
  it.each(Object.entries(SEEKER_UI_STRINGS))(
    "%s fills in every field",
    (_lang, strings) => {
      for (const value of Object.values(strings)) {
        expect(value.trim().length).toBeGreaterThan(0);
      }
    },
  );

  it("covers every field English covers", () => {
    const expected = Object.keys(SEEKER_UI_STRINGS.en!).sort();
    for (const [, strings] of Object.entries(SEEKER_UI_STRINGS)) {
      expect(Object.keys(strings).sort()).toEqual(expected);
    }
  });

  // Deliberate, not a coincidence: one deployment should not carry three
  // different opinions about which languages it speaks to. See the file
  // comment on `SEEKER_UI_STRINGS`.
  it("speaks to exactly the languages the crisis card does", () => {
    expect(Object.keys(SEEKER_UI_STRINGS).sort()).toEqual(
      Object.keys(CRISIS_STRINGS).sort(),
    );
  });
});

describe("seekerUiStringsFor", () => {
  it("matches a plain language code", () => {
    expect(seekerUiStringsFor("fr")).toEqual(SEEKER_UI_STRINGS.fr);
  });

  it("matches on the primary subtag of a fuller tag", () => {
    expect(seekerUiStringsFor("pt-BR")).toEqual(SEEKER_UI_STRINGS.pt);
    expect(seekerUiStringsFor("zh-Hans-CN")).toEqual(SEEKER_UI_STRINGS.zh);
  });

  it("is not thrown off by case", () => {
    expect(seekerUiStringsFor("FR-CA")).toEqual(SEEKER_UI_STRINGS.fr);
  });

  // The whole point of a fallback: a language nobody has written yet still
  // gets a complete, readable page rather than an empty label.
  it("falls back to English for a language not yet written", () => {
    expect(seekerUiStringsFor("cy")).toEqual(SEEKER_UI_STRINGS.en);
    expect(seekerUiStringsFor("")).toEqual(SEEKER_UI_STRINGS.en);
  });
});

describe("SEEKER_UI_LANGUAGES", () => {
  it("lists every language the string table actually has, once each", () => {
    expect(new Set(SEEKER_UI_LANGUAGES).size).toBe(SEEKER_UI_LANGUAGES.length);
    expect(SEEKER_UI_LANGUAGES.sort()).toEqual(Object.keys(SEEKER_UI_STRINGS).sort());
  });
});

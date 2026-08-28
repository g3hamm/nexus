import { describe, expect, it } from "vitest";
import {
  countriesWithCrisisResources,
  CRISIS_DIRECTORY,
  crisisResourcesFor,
  crisisStringsFor,
  INTERNATIONAL_DIRECTORY,
} from "./crisis.js";
import { CRISIS_STRINGS } from "./crisis-strings.js";

describe("resource selection", () => {
  it("returns local numbers for a country we have verified", () => {
    const resources = crisisResourcesFor("US", "en");
    expect(resources.emergency).toBe("911");
    expect(resources.helplines.map((h) => h.contact)).toContain("988");
  });

  it("accepts a lower-case country code", () => {
    expect(crisisResourcesFor("gb", "en").emergency).toBe("999");
  });

  // The whole point of the fallback: an unknown, absent, or wrong country
  // still leaves someone with somewhere to go.
  it.each([null, undefined, "", "ZZ", "not-a-country"])(
    "still returns the directory for %p",
    (country) => {
      const resources = crisisResourcesFor(country, "en");
      expect(resources.directory).toEqual(INTERNATIONAL_DIRECTORY);
      expect(resources.emergency).toBeNull();
      expect(resources.helplines).toEqual([]);
    },
  );

  it("includes the directory alongside local numbers, never instead of them", () => {
    const resources = crisisResourcesFor("BR", "pt");
    expect(resources.helplines.length).toBeGreaterThan(0);
    expect(resources.directory).toEqual(INTERNATIONAL_DIRECTORY);
  });
});

describe("card language", () => {
  it("uses the seeker's language", () => {
    expect(crisisResourcesFor("BR", "pt").strings.heading).toBe(
      CRISIS_STRINGS.pt!.heading,
    );
  });

  it("falls back from a regional tag to its base language", () => {
    expect(crisisStringsFor("pt-BR")).toEqual(CRISIS_STRINGS.pt);
    expect(crisisStringsFor("zh-Hans-CN")).toEqual(CRISIS_STRINGS.zh);
  });

  it("falls back to English for a language we have not written yet", () => {
    expect(crisisStringsFor("cy")).toEqual(CRISIS_STRINGS.en);
  });

  it("is case-insensitive about the base language", () => {
    expect(crisisStringsFor("FR-CA")).toEqual(CRISIS_STRINGS.fr);
  });
});

describe("directory integrity", () => {
  const entries = Object.entries(CRISIS_DIRECTORY);

  it("is not empty", () => {
    expect(entries.length).toBeGreaterThan(20);
  });

  it.each(entries)("%s is keyed by its own country code", (key, entry) => {
    expect(entry.country).toBe(key);
    expect(key).toMatch(/^[A-Z]{2}$/);
  });

  it.each(entries)("%s has an emergency number and at least one helpline", (_key, entry) => {
    expect(entry.emergency.trim().length).toBeGreaterThan(0);
    expect(entry.helplines.length).toBeGreaterThan(0);
  });

  it.each(entries)("%s names every helpline and gives it a contact", (_key, entry) => {
    for (const helpline of entry.helplines) {
      expect(helpline.name.trim().length).toBeGreaterThan(0);
      expect(helpline.contact.trim().length).toBeGreaterThan(0);
    }
  });

  // A number nobody has checked is a liability. Dating them is what makes a
  // stale entry visible rather than silent.
  it.each(entries)("%s records when it was last verified", (_key, entry) => {
    expect(entry.verifiedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(Date.parse(entry.verifiedOn))).toBe(false);
  });

  it("lists countries in a stable sorted order for the docs", () => {
    const listed = countriesWithCrisisResources();
    expect(listed).toEqual([...listed].sort());
  });
});

describe("string table integrity", () => {
  it.each(Object.entries(CRISIS_STRINGS))("%s fills in every field", (_lang, strings) => {
    for (const value of Object.values(strings)) {
      expect(value.trim().length).toBeGreaterThan(0);
    }
  });

  it("covers every field English covers", () => {
    const expected = Object.keys(CRISIS_STRINGS.en!).sort();
    for (const [, strings] of Object.entries(CRISIS_STRINGS)) {
      expect(Object.keys(strings).sort()).toEqual(expected);
    }
  });
});

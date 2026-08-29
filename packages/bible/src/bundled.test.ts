import { describe, expect, it } from "vitest";
import { BundledBibleProvider } from "./bundled-provider.js";
import { BOOKS } from "./books.js";

const bible = new BundledBibleProvider();

describe("the bundled World English Bible", () => {
  it("answers with no key, no database and no load step", async () => {
    const passage = await bible.lookup(
      { book: "John", chapter: 3, verse: 16, endVerse: null },
      { language: "en" },
    );

    expect(passage?.translationId).toBe("WEB");
    expect(passage?.verses[0]?.text).toContain("For God so loved the world");
    // Public domain worldwide, so nothing has to be rendered alongside it.
    expect(passage?.copyright).toBeNull();
  });

  it("reads a range", async () => {
    const passage = await bible.lookup(
      { book: "Ps", chapter: 23, verse: 1, endVerse: 3 },
      { language: "en" },
    );
    expect(passage?.verses.map((v) => v.verse)).toEqual([1, 2, 3]);
  });

  // What somebody writing "Psalm 23" meant.
  it("reads a whole chapter when no verse is given", async () => {
    const passage = await bible.lookup(
      { book: "Ps", chapter: 117, verse: null, endVerse: null },
      { language: "en" },
    );
    expect(passage?.verses).toHaveLength(2);
  });

  // The same judgement the database provider makes: a passage in a language
  // somebody cannot read, labelled as what it is, beats no passage at all.
  it("still answers a reader whose language it does not have", async () => {
    const passage = await bible.lookup(
      { book: "Rom", chapter: 8, verse: 28, endVerse: null },
      { language: "es" },
    );
    expect(passage?.language).toBe("en");
  });

  it("declines a translation it does not hold rather than substituting one", async () => {
    const passage = await bible.lookup(
      { book: "Rom", chapter: 8, verse: 28, endVerse: null },
      { language: "en", translationId: "KJV" },
    );
    expect(passage).toBeNull();
  });

  it.each([
    ["an unknown book", { book: "Enoch", chapter: 1, verse: 1, endVerse: null }],
    ["a chapter past the end", { book: "Ps", chapter: 151, verse: 1, endVerse: null }],
    ["a verse past the end", { book: "Ps", chapter: 117, verse: 40, endVerse: null }],
  ])("returns nothing for %s", async (_label, reference) => {
    expect(await bible.lookup(reference, { language: "en" })).toBeNull();
  });

  // The detector resolves "Juan 3:16" to an OSIS id, and every id it can
  // produce has to be lookupable — otherwise a reference underlines in the
  // message and then shows an empty card when somebody taps it.
  it("carries every book the reference detector can name", async () => {
    for (const [osis, book] of Object.entries(BOOKS)) {
      const first = await bible.lookup(
        { book: osis, chapter: 1, verse: 1, endVerse: null },
        { language: "en" },
      );
      expect(first, `${osis} 1:1`).not.toBeNull();

      // And the last chapter, so a book truncated by a bad conversion is
      // caught rather than passing on its opening verse.
      const last = await bible.lookup(
        { book: osis, chapter: book.chapters, verse: 1, endVerse: null },
        { language: "en" },
      );
      expect(last, `${osis} ${book.chapters}:1`).not.toBeNull();
    }
  });

  it("offers itself to an English reader and not to others", async () => {
    expect(await bible.listTranslations("en")).toHaveLength(1);
    expect(await bible.listTranslations("es")).toHaveLength(0);
    expect(await bible.listTranslations()).toHaveLength(1);
  });
});

import { describe, expect, it } from "vitest";
import { PatternReferenceDetector } from "./detector.js";
import { BOOKS } from "./books.js";
import { parseTranslationFile } from "./load.js";

const detector = new PatternReferenceDetector();
const detect = (text: string, language = "en") => detector.detect(text, language);
const refs = (text: string, language = "en") =>
  detect(text, language).map((d) => d.reference);

describe("finding references", () => {
  it("finds a plain chapter and verse", () => {
    expect(refs("Have a look at John 3:16")).toEqual([
      { book: "John", chapter: 3, verse: 16, endVerse: null },
    ]);
  });

  it("finds a range", () => {
    expect(refs("John 3:16-18 is the whole thought")).toEqual([
      { book: "John", chapter: 3, verse: 16, endVerse: 18 },
    ]);
  });

  it("accepts en dashes and em dashes in ranges", () => {
    expect(refs("Romans 8:38–39")[0]?.endVerse).toBe(39);
    expect(refs("Romans 8:38—39")[0]?.endVerse).toBe(39);
  });

  it("finds a whole chapter when the book is capitalised", () => {
    expect(refs("Psalm 23 got me through it")).toEqual([
      { book: "Ps", chapter: 23, verse: null, endVerse: null },
    ]);
  });

  it("handles abbreviations with and without a dot", () => {
    expect(refs("see Rom. 8:28")[0]?.book).toBe("Rom");
    expect(refs("see Rom 8:28")[0]?.book).toBe("Rom");
    expect(refs("1 Cor 13:4")[0]?.book).toBe("1Cor");
  });

  it("prefers the longer book name when two could match", () => {
    // "1 John" must not be read as "John".
    expect(refs("1 John 4:8")).toEqual([
      { book: "1John", chapter: 4, verse: 8, endVerse: null },
    ]);
    expect(refs("1John 4:8")[0]?.book).toBe("1John");
  });

  it("finds several references in one message", () => {
    const found = refs("Compare John 1:1 with Genesis 1:1 and Psalm 19");
    expect(found.map((r) => r.book)).toEqual(["John", "Gen", "Ps"]);
  });

  it("reports where the match sits, so the UI can underline it in place", () => {
    const text = "I keep coming back to John 3:16 lately";
    const [found] = detect(text);
    expect(found?.matchedText).toBe("John 3:16");
    expect(text.slice(found!.startIndex, found!.endIndex)).toBe("John 3:16");
  });
});

describe("other languages", () => {
  it("finds Spanish references", () => {
    expect(refs("Juan 3:16 lo dice todo", "es")[0]?.book).toBe("John");
    expect(refs("Salmos 23", "es")[0]?.book).toBe("Ps");
    expect(refs("1 Corintios 13:4", "es")[0]?.book).toBe("1Cor");
  });

  it("finds Portuguese references", () => {
    expect(refs("João 3:16", "pt")[0]?.book).toBe("John");
    expect(refs("Provérbios 3:5", "pt")[0]?.book).toBe("Prov");
  });

  it("finds French references", () => {
    expect(refs("Jean 3:16", "fr")[0]?.book).toBe("John");
    expect(refs("Psaume 23", "fr")[0]?.book).toBe("Ps");
  });

  it("resolves every language to the same reference", () => {
    const en = refs("John 3:16")[0];
    for (const text of ["Juan 3:16", "João 3:16", "Jean 3:16"]) {
      expect(refs(text)[0]).toEqual(en);
    }
  });
});

describe("not mistaking ordinary words for scripture", () => {
  it("leaves a lowercase job alone", () => {
    // The motivating case. A seeker saying this must not get a scripture link.
    expect(refs("I lost my job 3 years ago")).toEqual([]);
  });

  it("leaves other lowercase homographs alone", () => {
    expect(refs("he acts 3 different ways")).toEqual([]);
    expect(refs("i got 2 mark 5 times")).toEqual([]);
    expect(refs("the song 4 minutes long")).toEqual([]);
  });

  it("still accepts a lowercase book when a verse is given", () => {
    // Nobody writes "job 3:16" about employment.
    expect(refs("see job 3:16")[0]?.book).toBe("Job");
  });

  it("accepts a capitalised book with a bare chapter", () => {
    expect(refs("Job 3 is bleak")[0]?.book).toBe("Job");
  });

  it("rejects a chapter the book does not have", () => {
    // Jude has one chapter, so this is a quantity, not a reference.
    expect(refs("Jude 40")).toEqual([]);
    // John has 21.
    expect(refs("John 99:1")).toEqual([]);
  });

  it("does not match inside a longer word", () => {
    expect(refs("Marky 3:1")).toEqual([]);
    expect(refs("xJohn 3:16")).toEqual([]);
  });

  it("ignores a backwards range rather than inventing one", () => {
    const found = refs("John 3:18-16")[0];
    expect(found?.verse).toBe(18);
    expect(found?.endVerse).toBeNull();
  });

  it("finds nothing in ordinary conversation", () => {
    expect(refs("I have been thinking about this for 3 years and I am 16 now")).toEqual(
      [],
    );
  });
});

describe("re-running the detector", () => {
  it("gives the same answer every time", () => {
    // The regex is shared and stateful; a stale lastIndex would silently
    // drop matches on the second call.
    const text = "John 3:16 and Romans 8:28";
    expect(refs(text)).toEqual(refs(text));
    expect(refs(text)).toHaveLength(2);
  });
});

describe("parseTranslationFile", () => {
  const book = (chapters: string[][]) => ({ chapters });

  /**
   * A file with the right shape but tiny contents.
   *
   * Overrides replace the *first chapter* of a book and the rest are padded,
   * so the file keeps each book's real chapter count — otherwise the loader's
   * ordering guard rejects the fixture, which is the guard working correctly.
   */
  function canonicalFile(firstChapterOverrides: Record<number, string[]> = {}) {
    return JSON.stringify(
      Object.entries(BOOKS).map(([, meta], index) =>
        book(
          Array.from({ length: meta.chapters }, (_, chapterIndex) =>
            chapterIndex === 0 && firstChapterOverrides[index]
              ? firstChapterOverrides[index]!
              : ["placeholder verse"],
          ),
        ),
      ),
    );
  }

  it("maps book position to the right OSIS id", () => {
    const { verses } = parseTranslationFile(canonicalFile({ 42: ["John text"] }));
    // John is the 43rd book. Getting this wrong silently mislabels the
    // entire translation.
    expect(verses.some((v) => v.book === "John" && v.text === "John text")).toBe(true);
    expect(verses.filter((v) => v.book === "Gen")).not.toHaveLength(0);
    expect(verses.filter((v) => v.book === "Rev")).not.toHaveLength(0);
  });

  it("numbers chapters and verses from one, not zero", () => {
    const { verses } = parseTranslationFile(canonicalFile({ 0: ["first", "second"] }));
    const genesis = verses.filter((v) => v.book === "Gen" && v.chapter === 1);
    expect(genesis[0]).toMatchObject({ chapter: 1, verse: 1, text: "first" });
    expect(genesis[1]).toMatchObject({ chapter: 1, verse: 2, text: "second" });
  });

  it("tolerates a byte-order mark", () => {
    // Published Bible JSON very often has one, and JSON.parse's error for it
    // tells you nothing useful.
    expect(() => parseTranslationFile("﻿" + canonicalFile())).not.toThrow();
  });

  it("refuses a file with the wrong number of books", () => {
    expect(() => parseTranslationFile(JSON.stringify([book([["x"]])]))).toThrow(
      /66 books in canonical order/,
    );
  });

  it("refuses a book whose chapter count does not match", () => {
    // The strongest available signal that a file is in a different order.
    const truncated = JSON.parse(canonicalFile()) as { chapters: string[][] }[];
    truncated[0]!.chapters = [["x"]];
    expect(() => parseTranslationFile(JSON.stringify(truncated))).toThrow(
      /probably not in the canonical order/,
    );
  });

  it("skips empty verses rather than storing blanks", () => {
    const { verses } = parseTranslationFile(canonicalFile({ 0: ["real", "", "   "] }));
    expect(verses.filter((v) => v.book === "Gen" && v.chapter === 1)).toHaveLength(1);
  });

  it("rejects something that is not an array of books", () => {
    expect(() => parseTranslationFile('{"books":[]}')).toThrow(/array of books/);
  });
});

/**
 * Rebuilds `src/data/web.json` from the World English Bible sources.
 *
 *   node packages/bible/scripts/build-web-json.mjs
 *
 * Run once, by hand, when the text needs refreshing. It is here because the
 * next person will reasonably ask where four megabytes of scripture in this
 * repository came from, and "someone downloaded it" is not an answer anybody
 * can check.
 *
 * Source: github.com/TehShrike/world-english-bible — the WEB as per-book JSON,
 * already split into verses. The World English Bible is dedicated to the
 * public domain by its publisher, worldwide and without conditions.
 *
 * Output shape, chosen to be small rather than pretty:
 *
 *   { "Gen": [ ["verse 1", "verse 2", …], … ], … }
 *
 * Books are keyed by the OSIS ids in `books.ts`, chapters and verses are
 * zero-indexed arrays, and a verse the WEB does not carry is an empty string
 * rather than a hole — several later manuscripts' additions are absent, and
 * the provider skips them.
 */
import { writeFileSync } from "node:fs";
import { BOOKS } from "../dist/books.js";

const BASE =
  "https://raw.githubusercontent.com/TehShrike/world-english-bible/master/json";
/** Poetry carries its verses as lines, so dropping these loses the Psalms. */
const TEXT_TYPES = new Set(["paragraph text", "line text"]);

const out = {};
let verses = 0;

for (const [osis, book] of Object.entries(BOOKS)) {
  const file = book.english.toLowerCase().replaceAll(" ", "");
  const response = await fetch(`${BASE}/${file}.json`);
  if (!response.ok) throw new Error(`${osis}: ${file}.json — HTTP ${response.status}`);

  const chapters = new Map();
  for (const item of await response.json()) {
    if (!TEXT_TYPES.has(item.type)) continue;
    const { chapterNumber: c, verseNumber: v, value = "" } = item;
    if (!Number.isInteger(c) || !Number.isInteger(v)) continue;
    const chapter = chapters.get(c) ?? new Map();
    chapter.set(v, [...(chapter.get(v) ?? []), value]);
    chapters.set(c, chapter);
  }

  const highest = Math.max(...chapters.keys());
  if (highest !== book.chapters) {
    throw new Error(`${osis}: found ${highest} chapters, expected ${book.chapters}`);
  }

  out[osis] = Array.from({ length: book.chapters }, (_, i) => {
    const chapter = chapters.get(i + 1) ?? new Map();
    const last = chapter.size > 0 ? Math.max(...chapter.keys()) : 0;
    return Array.from({ length: last }, (_, j) => {
      const text = (chapter.get(j + 1) ?? []).join(" ").replace(/\s+/g, " ").trim();
      if (text) verses += 1;
      return text;
    });
  });

  console.log(`  ✓ ${book.english}`);
}

writeFileSync(new URL("../src/data/web.json", import.meta.url), JSON.stringify(out));
console.log(`\n${Object.keys(out).length} books, ${verses} verses.\n`);

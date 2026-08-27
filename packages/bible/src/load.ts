/**
 * Loads a public-domain translation into the database.
 *
 *   pnpm bible:load --file ./kjv.json --id kjv --name "King James Version" \
 *     --language en --public-domain
 *
 * The `--public-domain` flag is required and is not a formality. Plenty of
 * Bible JSON files circulate as though they were free that are not — NVI, RVR
 * 1960 and ARA among them — and loading one would put Nexus in breach without
 * anyone noticing. Asserting it is a deliberate act by whoever runs this.
 *
 * Accepts the widely-used array-of-books shape:
 *
 *   [ { "name": "Genesis", "chapters": [ ["verse 1", "verse 2"], ... ] }, ... ]
 *
 * with books in canonical order.
 */
import { parseArgs } from "node:util";
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { BOOKS } from "./books.js";

export interface ParsedTranslation {
  readonly verses: readonly {
    readonly book: string;
    readonly chapter: number;
    readonly verse: number;
    readonly text: string;
  }[];
}

/** Canonical order, which is how a book's position maps to its OSIS id. */
const CANONICAL_ORDER = Object.keys(BOOKS);

export function parseTranslationFile(raw: string): ParsedTranslation {
  // Published Bible JSON is very often UTF-8 with a BOM, which JSON.parse
  // rejects with a message that tells you nothing useful.
  const parsed: unknown = JSON.parse(raw.replace(/^\uFEFF/, ""));
  if (!Array.isArray(parsed)) {
    throw new Error("Expected an array of books at the top level");
  }

  if (parsed.length !== CANONICAL_ORDER.length) {
    throw new Error(
      `Expected ${CANONICAL_ORDER.length} books in canonical order, found ${parsed.length}. ` +
        `Files with apocrypha or a different ordering need their own mapping.`,
    );
  }

  const verses: { book: string; chapter: number; verse: number; text: string }[] = [];

  parsed.forEach((book, bookIndex) => {
    const osis = CANONICAL_ORDER[bookIndex];
    if (!osis) return;

    const chapters = (book as { chapters?: unknown }).chapters;
    if (!Array.isArray(chapters)) {
      throw new Error(`Book ${osis} has no chapters array`);
    }

    const expected = BOOKS[osis]?.chapters;
    if (expected !== undefined && chapters.length !== expected) {
      throw new Error(
        `Book ${osis} has ${chapters.length} chapters, expected ${expected}. ` +
          `The file is probably not in the canonical order this loader assumes.`,
      );
    }

    chapters.forEach((chapter, chapterIndex) => {
      if (!Array.isArray(chapter)) return;
      chapter.forEach((text, verseIndex) => {
        if (typeof text !== "string" || text.trim().length === 0) return;
        verses.push({
          book: osis,
          chapter: chapterIndex + 1,
          verse: verseIndex + 1,
          text: text.trim(),
        });
      });
    });
  });

  return { verses };
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      file: { type: "string" },
      id: { type: "string" },
      name: { type: "string" },
      language: { type: "string", default: "en" },
      "public-domain": { type: "boolean", default: false },
      copyright: { type: "string" },
    },
    allowPositionals: false,
  });

  if (!values.file || !values.id || !values.name) {
    console.error(
      "Usage: pnpm bible:load --file <path> --id <code> --name <name> " +
        "[--language en] --public-domain",
    );
    process.exit(1);
  }

  if (!values["public-domain"]) {
    console.error(
      "\nRefusing to load without --public-domain.\n\n" +
        "  Only public-domain translations may be self-hosted. Several files\n" +
        "  circulating as free downloads are not — check before asserting it.\n" +
        "  See docs/adr/0006-bible-text-sources.md.\n",
    );
    process.exit(1);
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const { createDatabase, schema } = await import("@nexus/db");
  const db = createDatabase(url);

  console.log(`Parsing ${values.file}…`);
  const { verses } = parseTranslationFile(readFileSync(values.file, "utf8"));
  console.log(`  ${verses.length.toLocaleString()} verses`);

  await db
    .insert(schema.bibleTranslations)
    .values({
      id: values.id,
      name: values.name,
      language: values.language,
      publicDomain: true,
      copyright: values.copyright ?? null,
    })
    .onConflictDoUpdate({
      target: schema.bibleTranslations.id,
      set: { name: values.name, language: values.language, publicDomain: true },
    });

  // Replace wholesale, so re-loading a corrected file does not leave a
  // mixture of two versions of the text.
  await db
    .delete(schema.bibleVerses)
    .where(eq(schema.bibleVerses.translationId, values.id));

  // Chunked: a single insert of 31,000 rows exceeds what the HTTP driver
  // will carry in one statement.
  const CHUNK = 2000;
  for (let i = 0; i < verses.length; i += CHUNK) {
    const batch = verses.slice(i, i + CHUNK);
    await db
      .insert(schema.bibleVerses)
      .values(batch.map((v) => ({ ...v, translationId: values.id! })));
    process.stdout.write(
      `\r  loaded ${Math.min(i + CHUNK, verses.length).toLocaleString()} / ${verses.length.toLocaleString()}`,
    );
  }

  console.log(`\n\n${values.name} is loaded and available.\n`);
}

if (process.argv[1]?.endsWith("load.ts") || process.argv[1]?.endsWith("load.js")) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}

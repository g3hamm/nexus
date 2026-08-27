/**
 * Loads markdown documents into the knowledge base.
 *
 *   pnpm knowledge:load ./content/knowledge
 *
 * Each file needs a small header, then a markdown body:
 *
 *   ---
 *   kind: objection_response
 *   source: Author, Title (edition)
 *   language: en
 *   doctrineProfiles: ecumenical-creedal
 *   ---
 *   # Does God hear prayer?
 *   ...
 *
 * `source` is not optional decoration — the sidebar cites it to the volunteer,
 * who needs to know whose argument they are about to repeat.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { createHash } from "node:crypto";
import type { DocumentKind, KnowledgeDocument } from "@nexus/core";
import { asDocumentId } from "@nexus/core";
import { createDatabase } from "@nexus/db";
import { createEmbeddingProvider } from "./embeddings.js";
import { PgVectorKnowledgeBase } from "./store.js";

const KINDS: readonly DocumentKind[] = [
  "apologetics",
  "doctrine",
  "objection_response",
  "testimony",
  "practical_guidance",
  "cultural_context",
];

interface ParsedDocument {
  readonly title: string;
  readonly kind: DocumentKind;
  readonly source: string;
  readonly language: string;
  readonly doctrineProfiles: readonly string[];
  readonly body: string;
}

export function parseDocument(raw: string, filename: string): ParsedDocument {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(raw.trim());
  if (!match) {
    throw new Error(`${filename}: missing the --- header block`);
  }

  const [, header = "", body = ""] = match;
  const fields = new Map<string, string>();
  for (const line of header.split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx > 0) {
      fields.set(line.slice(0, idx).trim(), line.slice(idx + 1).trim());
    }
  }

  const titleMatch = /^#\s+(.+)$/m.exec(body);
  const title = fields.get("title") ?? titleMatch?.[1]?.trim();
  if (!title) {
    throw new Error(`${filename}: needs a title, either in the header or as "# Heading"`);
  }

  const kind = (fields.get("kind") ?? "apologetics") as DocumentKind;
  if (!KINDS.includes(kind)) {
    throw new Error(`${filename}: unknown kind "${kind}". One of: ${KINDS.join(", ")}`);
  }

  const source = fields.get("source");
  if (!source) {
    throw new Error(
      `${filename}: needs a "source" — the sidebar cites it, and a volunteer ` +
        `should know whose argument they are repeating`,
    );
  }

  const profiles = (fields.get("doctrineProfiles") ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  return {
    title,
    kind,
    source,
    language: fields.get("language") ?? "en",
    doctrineProfiles: profiles,
    body: body.trim(),
  };
}

/** Stable id from the filename, so re-loading updates rather than duplicates. */
function idFor(filename: string): string {
  const hash = createHash("sha1").update(filename).digest("hex");
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    // Version 4 UUID shape, so it fits the uuid column.
    `4${hash.slice(13, 16)}`,
    `8${hash.slice(17, 20)}`,
    hash.slice(20, 32),
  ].join("-");
}

async function main(): Promise<void> {
  const directory = process.argv[2];
  if (!directory) {
    console.error("Usage: pnpm knowledge:load <directory>");
    process.exit(1);
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const embeddings = createEmbeddingProvider({
    provider: process.env.NEXUS_EMBEDDING_PROVIDER ?? "hashing",
    voyageApiKey: process.env.VOYAGE_API_KEY,
    isProduction: process.env.NODE_ENV === "production",
  });

  const store = new PgVectorKnowledgeBase(createDatabase(url), embeddings);

  const files = readdirSync(directory)
    .filter((f) => extname(f) === ".md")
    .filter((f) => statSync(join(directory, f)).isFile())
    .sort();

  if (files.length === 0) {
    console.error(`No .md files found in ${directory}`);
    process.exit(1);
  }

  console.log(`Embedding with "${embeddings.name}" (${embeddings.dimensions} dims)\n`);

  let loaded = 0;
  for (const file of files) {
    try {
      const parsed = parseDocument(readFileSync(join(directory, file), "utf8"), file);
      const document: KnowledgeDocument = {
        id: asDocumentId(idFor(file)),
        title: parsed.title,
        kind: parsed.kind,
        language: parsed.language,
        source: parsed.source,
        doctrineProfiles: parsed.doctrineProfiles,
        body: parsed.body,
        updatedAt: new Date(),
      };
      await store.upsert(document);
      console.log(`  ✓ ${parsed.title}`);
      loaded += 1;
    } catch (error) {
      console.error(`  ✗ ${file}: ${error instanceof Error ? error.message : error}`);
    }
  }

  console.log(`\n${loaded} of ${files.length} document(s) loaded.\n`);
  if (loaded < files.length) process.exit(1);
}

// Only run as a script, so the parser can be imported by tests.
if (process.argv[1]?.endsWith("load.ts") || process.argv[1]?.endsWith("load.js")) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}

/**
 * Emits one self-contained SQL file that can be pasted into Neon's SQL Editor.
 *
 * Exists so that setting Nexus up does not require a terminal. Running
 * migrations is otherwise the only step that cannot be done from a browser,
 * which is a poor reason to demand someone install Node and clone a repo.
 *
 * The file it produces is not just the migration. It also writes the rows
 * drizzle uses to track what it has applied — so if anyone later runs
 * `pnpm db:migrate` against the same database, drizzle sees the work as
 * already done and skips it instead of failing on tables that exist.
 *
 *   pnpm db:sql        # regenerates docs/setup.sql
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const drizzleDir = join(here, "..", "drizzle");
const outputPath = join(here, "..", "..", "..", "docs", "setup.sql");

interface JournalEntry {
  readonly idx: number;
  readonly when: number;
  readonly tag: string;
  readonly breakpoints: boolean;
}

/**
 * Rewrites one statement so running it twice is harmless.
 *
 * drizzle-kit emits migrations for a migrator that tracks what it has already
 * applied, so it has no reason to guard anything. Pasting into a SQL editor
 * has no such tracking, and someone following instructions by hand will
 * absolutely run it twice — after a timeout, or because they were not sure it
 * worked the first time. A second run should be a no-op, not a wall of errors
 * that looks like they broke something.
 */
function makeIdempotent(statement: string): string {
  // CREATE TABLE / CREATE INDEX take IF NOT EXISTS directly.
  if (statement.startsWith("CREATE TABLE ")) {
    return statement.replace(/^CREATE TABLE /, "CREATE TABLE IF NOT EXISTS ");
  }
  if (statement.startsWith("CREATE UNIQUE INDEX ")) {
    return statement.replace(
      /^CREATE UNIQUE INDEX /,
      "CREATE UNIQUE INDEX IF NOT EXISTS ",
    );
  }
  if (statement.startsWith("CREATE INDEX ")) {
    return statement.replace(/^CREATE INDEX /, "CREATE INDEX IF NOT EXISTS ");
  }

  // Postgres has no IF NOT EXISTS for CREATE TYPE or ADD CONSTRAINT, so these
  // catch the duplicate instead.
  //
  // Both conditions are needed and they are not interchangeable: a repeated
  // CREATE TYPE or ADD CONSTRAINT raises duplicate_object (42710), while a
  // repeated ADD COLUMN raises duplicate_column (42701). Catching only the
  // first lets a second run of an ALTER TABLE ... ADD COLUMN migration fail.
  //
  // Still deliberately narrow. A blanket handler would swallow genuine errors
  // and report success, which is far worse than a visible failure.
  if (statement.startsWith("CREATE TYPE ") || statement.startsWith("ALTER TABLE ")) {
    return [
      "DO $$ BEGIN",
      `  ${statement}`,
      "EXCEPTION WHEN duplicate_object OR duplicate_column THEN NULL;",
      "END $$;",
    ].join("\n");
  }

  return statement;
}

function main(): void {
  const journal = JSON.parse(
    readFileSync(join(drizzleDir, "meta", "_journal.json"), "utf8"),
  ) as { entries: JournalEntry[] };

  const parts: string[] = [
    "-- ───────────────────────────────────────────────────────────────────────",
    "-- Nexus — one-time database setup",
    "--",
    "-- Paste this whole file into the Neon SQL Editor and press Run.",
    "-- It is safe to run more than once: everything below is guarded, so a",
    "-- second run changes nothing rather than failing.",
    "--",
    "-- GENERATED FILE — do not edit by hand. Regenerate with: pnpm db:sql",
    "-- ───────────────────────────────────────────────────────────────────────",
    "",
    "-- pgvector powers similarity search in the knowledge base. It has to exist",
    "-- before the tables that use it, and drizzle-kit does not emit this line.",
    "CREATE EXTENSION IF NOT EXISTS vector;",
    "",
  ];

  for (const entry of journal.entries) {
    const raw = readFileSync(join(drizzleDir, `${entry.tag}.sql`), "utf8");
    // Exactly how drizzle hashes it: sha256 over the untouched file contents.
    const hash = createHash("sha256").update(raw).digest("hex");

    parts.push(
      `-- ── Migration ${entry.tag} ───────────────────────────────────────`,
      "",
      // Statement breakpoints are drizzle's own separator, not SQL.
      raw
        .split("--> statement-breakpoint")
        .map((statement) => statement.trim())
        .filter(Boolean)
        .map(makeIdempotent)
        .join("\n\n"),
      "",
    );

    parts.push(
      "-- Record this migration as applied, so a later `pnpm db:migrate` skips",
      "-- it rather than failing on tables that already exist.",
      "CREATE SCHEMA IF NOT EXISTS drizzle;",
      "CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (",
      "  id SERIAL PRIMARY KEY,",
      "  hash text NOT NULL,",
      "  created_at bigint",
      ");",
      "",
      "INSERT INTO drizzle.__drizzle_migrations (hash, created_at)",
      `SELECT '${hash}', ${entry.when}`,
      "WHERE NOT EXISTS (",
      `  SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = '${hash}'`,
      ");",
      "",
    );
  }

  parts.push(
    "-- ── Done ───────────────────────────────────────────────────────────────",
    "-- You should see eight tables under 'public' in the Neon Tables view.",
    "",
  );

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, parts.join("\n"));
  console.log(`Wrote ${outputPath}`);
}

main();

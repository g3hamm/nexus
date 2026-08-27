/**
 * Reports what is actually in the database.
 *
 * Written because "did the migrations run?" is a question you should be able
 * to answer in five seconds rather than by squinting at a console, and because
 * the failure it catches is quiet: with no tables the app does not misbehave
 * subtly, it 500s on the first seeker — but only once someone tries.
 *
 *   pnpm db:check
 */
import { neon } from "@neondatabase/serverless";

/** Every table the schema expects, with what it is for. */
const EXPECTED_TABLES: ReadonlyArray<readonly [string, string]> = [
  ["volunteers", "volunteer accounts"],
  ["admins", "admin accounts"],
  ["conversations", "conversations and their wrapped data keys"],
  ["messages", "encrypted message renderings"],
  ["moderation_flags", "judge verdicts awaiting review"],
  ["audit_log", "append-only record of consequential actions"],
  ["knowledge_documents", "apologetics source documents"],
  ["knowledge_chunks", "embedded chunks for retrieval"],
];

const OK = "✓";
const NO = "✗";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      `${NO} DATABASE_URL is not set.\n\n` +
        `  Copy .env.example to .env.local and fill it in, then re-run.\n`,
    );
    process.exit(1);
  }

  const sql = neon(url);
  let healthy = true;

  // Say which database, so a check against the wrong Neon branch is obvious.
  try {
    const [info] = (await sql`
      select current_database() as db, version() as version
    `) as { db: string; version: string }[];
    const postgres = info?.version.split(" ").slice(0, 2).join(" ") ?? "unknown";
    console.log(`\nConnected to "${info?.db}" (${postgres})`);
    console.log(`Host: ${new URL(url).host}\n`);
  } catch (error) {
    console.error(`${NO} Could not connect.\n`);
    console.error(error instanceof Error ? error.message : error);
    console.error(
      `\n  Check DATABASE_URL is the POOLED connection string (it has` +
        ` "-pooler" in\n  the host) and ends with ?sslmode=require.\n`,
    );
    process.exit(1);
  }

  // pgvector. The knowledge base cannot be built without it, and drizzle-kit
  // does not emit the CREATE EXTENSION — db:migrate does that.
  const extensions = (await sql`
    select extname from pg_extension where extname = 'vector'
  `) as { extname: string }[];

  if (extensions.length > 0) {
    console.log(`${OK} pgvector is enabled`);
  } else {
    console.log(`${NO} pgvector is NOT enabled`);
    healthy = false;
  }

  // Tables.
  const present = new Set(
    (
      (await sql`
        select table_name from information_schema.tables
        where table_schema = 'public'
      `) as { table_name: string }[]
    ).map((r) => r.table_name),
  );

  console.log("");
  for (const [table, purpose] of EXPECTED_TABLES) {
    if (present.has(table)) {
      console.log(`${OK} ${table.padEnd(22)} ${purpose}`);
    } else {
      console.log(`${NO} ${table.padEnd(22)} MISSING — ${purpose}`);
      healthy = false;
    }
  }

  // Applied migrations, from drizzle's own bookkeeping table.
  try {
    const applied = (await sql`
      select count(*)::int as count from drizzle.__drizzle_migrations
    `) as { count: number }[];
    console.log(`\n${OK} ${applied[0]?.count ?? 0} migration(s) applied`);
  } catch {
    console.log(`\n${NO} No migration history — db:migrate has never run here`);
    healthy = false;
  }

  // Row counts, but only for what exists, and never message content.
  if (present.has("volunteers") && present.has("conversations")) {
    const [counts] = (await sql`
      select
        (select count(*)::int from volunteers) as volunteers,
        (select count(*)::int from volunteers where approved_at is not null) as approved,
        (select count(*)::int from conversations) as conversations
    `) as { volunteers: number; approved: number; conversations: number }[];

    console.log(
      `\n  volunteers      ${counts?.volunteers ?? 0} (${counts?.approved ?? 0} approved)`,
    );
    console.log(`  conversations   ${counts?.conversations ?? 0}`);

    if ((counts?.approved ?? 0) === 0) {
      console.log(
        `\n  No approved volunteers yet, so nobody can answer a seeker.\n` +
          `  Create one:\n` +
          `    pnpm seed:volunteer --email you@example.org --name "Your Name" --languages en`,
      );
    }
  }

  if (healthy) {
    console.log(`\n${OK} Database is ready.\n`);
  } else {
    console.log(
      `\n${NO} Database is not ready. Run:\n\n    pnpm db:migrate\n\n` +
        `  If that succeeds and this still fails, DATABASE_URL is probably\n` +
        `  pointing at a different Neon project or branch than you think.\n`,
    );
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

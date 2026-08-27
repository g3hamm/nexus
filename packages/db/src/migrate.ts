/**
 * Applies migrations, and enables pgvector first.
 *
 * `CREATE EXTENSION vector` has to run before any migration that declares a
 * vector column, and drizzle-kit will not emit it — so it lives here rather
 * than in a hand-edited migration that the next `drizzle-kit generate` would
 * silently clobber.
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { sql } from "drizzle-orm";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Copy .env.example to .env.local first.");
    process.exit(1);
  }

  const db = drizzle(neon(url));

  console.log("Enabling pgvector…");
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);

  console.log("Applying migrations…");
  await migrate(db, { migrationsFolder: "./drizzle" });

  console.log("Done.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

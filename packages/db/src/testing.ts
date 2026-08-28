/**
 * A database connection for tests.
 *
 * Uses node-postgres rather than Neon's HTTP driver so the repositories can be
 * exercised against a plain local Postgres. Everything above the connection is
 * the same code that runs in production — same schema, same queries, same
 * encryption at the boundary.
 *
 * Not imported by the app. It lives here rather than in a test folder because
 * it needs the schema, and because a repository test in any package should be
 * able to reach it.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type { NexusDatabase } from "./client.js";
import { schema } from "./schema.js";

export interface TestDatabase {
  readonly db: NexusDatabase;
  /** Closes the pool. Tests hang without this. */
  close(): Promise<void>;
}

export function createTestDatabase(connectionString: string): TestDatabase {
  const pool = new Pool({ connectionString, max: 4 });
  return {
    db: drizzle(pool, { schema }) as unknown as NexusDatabase,
    close: () => pool.end(),
  };
}

/**
 * The connection string integration tests run against, or null.
 *
 * Returning null rather than throwing lets the suite skip cleanly on a machine
 * with no Postgres, which is most contributors most of the time. The tests say
 * out loud that they were skipped — a silently empty suite is how this gap
 * persisted in the first place.
 */
export function testDatabaseUrl(): string | null {
  return process.env.TEST_DATABASE_URL ?? null;
}

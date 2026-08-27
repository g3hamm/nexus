import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { schema } from "./schema.js";

/**
 * Neon's HTTP driver, not a TCP pool.
 *
 * Nexus runs on serverless functions, where a connection pool is a liability:
 * instances come and go constantly and each one holding a Postgres connection
 * exhausts the server long before the app is under real load. The HTTP driver
 * has no persistent connection to leak.
 *
 * The trade is that multi-statement transactions are not available over HTTP.
 * Nothing here needs them — the one operation that must be atomic (a volunteer
 * claiming a waiting conversation) is expressed as a single conditional UPDATE
 * instead, which is both simpler and correct under concurrency.
 */
export function createDatabase(connectionString: string) {
  return drizzle(neon(connectionString), { schema });
}

export type NexusDatabase = ReturnType<typeof createDatabase>;

import { neon } from "@neondatabase/serverless";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
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
export function createDatabase(connectionString: string): NexusDatabase {
  return drizzle(neon(connectionString), { schema });
}

/**
 * What repositories are written against.
 *
 * Deliberately the shared Postgres base class rather than the Neon driver's
 * own type. Both `NeonHttpDatabase` and `NodePgDatabase` extend it, so the
 * same repository code can run against Neon in production and a plain local
 * Postgres under test.
 *
 * That is not a hypothetical nicety. Repositories previously could not be
 * tested at all, because the type was bolted to a driver that only speaks to
 * Neon over HTTP — and the first real consequence was a `create({ approved:
 * true })` flag that the INSERT silently dropped, which nothing caught until
 * a person could not sign in.
 */
export type NexusDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;

import { desc, eq, sql } from "drizzle-orm";
import type { Admin, AdminId, AdminRepository } from "@nexus/core";
import { asAdminId } from "@nexus/core";
import type { NexusDatabase } from "../client.js";
import { admins } from "../schema.js";

/**
 * Admin accounts.
 *
 * Deliberately thin. An admin can read every transcript on the platform, so
 * the surface for creating one is kept as small as possible: first-run setup,
 * or a script run by someone with database credentials. There is no
 * self-service signup and there should not be.
 */
export class DrizzleAdminRepository implements AdminRepository {
  readonly #db: NexusDatabase;

  constructor(db: NexusDatabase) {
    this.#db = db;
  }

  async findById(id: AdminId): Promise<Admin | null> {
    const rows = await this.#db.select().from(admins).where(eq(admins.id, id)).limit(1);
    const row = rows[0];
    return row ? toAdmin(row) : null;
  }

  async findByEmail(email: string): Promise<Admin | null> {
    const rows = await this.#db
      .select()
      .from(admins)
      .where(eq(admins.email, email.toLowerCase()))
      .limit(1);
    const row = rows[0];
    return row ? toAdmin(row) : null;
  }

  async create(input: {
    displayName: string;
    email: string;
    passwordHash: string;
  }): Promise<Admin> {
    const rows = await this.#db
      .insert(admins)
      .values({
        displayName: input.displayName,
        email: input.email.toLowerCase(),
        passwordHash: input.passwordHash,
      })
      .returning();

    const row = rows[0];
    if (!row) throw new Error("Insert returned no admin row");
    return toAdmin(row);
  }

  async passwordHashFor(email: string): Promise<string | null> {
    const rows = await this.#db
      .select({ hash: admins.passwordHash })
      .from(admins)
      .where(eq(admins.email, email.toLowerCase()))
      .limit(1);
    return rows[0]?.hash ?? null;
  }

  async count(): Promise<number> {
    const rows = await this.#db
      .select({ total: sql<number>`count(*)::int` })
      .from(admins);
    return rows[0]?.total ?? 0;
  }

  /** Newest first. Only used by the roster screen. */
  async listAll(limit: number): Promise<readonly Admin[]> {
    const rows = await this.#db
      .select()
      .from(admins)
      .orderBy(desc(admins.createdAt))
      .limit(limit);
    return rows.map(toAdmin);
  }
}

function toAdmin(row: typeof admins.$inferSelect): Admin {
  return {
    id: asAdminId(row.id),
    displayName: row.displayName,
    email: row.email,
    createdAt: row.createdAt,
  };
}

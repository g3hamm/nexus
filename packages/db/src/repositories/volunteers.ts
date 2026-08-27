import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import type {
  LanguageCode,
  Volunteer,
  VolunteerId,
  VolunteerRepository,
} from "@nexus/core";
import type { NexusDatabase } from "../client.js";
import { conversations, volunteers } from "../schema.js";
import { toVolunteer } from "./mappers.js";

export class DrizzleVolunteerRepository implements VolunteerRepository {
  readonly #db: NexusDatabase;

  constructor(db: NexusDatabase) {
    this.#db = db;
  }

  async findById(id: VolunteerId): Promise<Volunteer | null> {
    const rows = await this.#db
      .select()
      .from(volunteers)
      .where(eq(volunteers.id, id))
      .limit(1);
    const row = rows[0];
    return row ? toVolunteer(row) : null;
  }

  async findByEmail(email: string): Promise<Volunteer | null> {
    const rows = await this.#db
      .select()
      .from(volunteers)
      .where(eq(volunteers.email, email.toLowerCase()))
      .limit(1);
    const row = rows[0];
    return row ? toVolunteer(row) : null;
  }

  /**
   * Volunteers who can take another conversation right now.
   *
   * `language` is a preference, not a filter — translation means an English
   * speaker can help a Farsi speaker. Callers rank on language; this method
   * only answers "who is actually free", and enforces the concurrency cap so
   * a volunteer set to one conversation is never handed a second.
   */
  async findAvailable(_language?: LanguageCode): Promise<readonly Volunteer[]> {
    const activeCount = sql<number>`(
      select count(*) from ${conversations}
      where ${conversations.volunteerId} = ${volunteers.id}
        and ${conversations.status} = 'active'
    )`;

    const rows = await this.#db
      .select()
      .from(volunteers)
      .where(
        and(
          eq(volunteers.status, "available"),
          isNotNull(volunteers.approvedAt),
          isNull(volunteers.suspendedAt),
          sql`${activeCount} < ${volunteers.maxConcurrentConversations}`,
        ),
      );

    return rows.map(toVolunteer);
  }

  async listAll(limit: number): Promise<readonly Volunteer[]> {
    const rows = await this.#db
      .select()
      .from(volunteers)
      .orderBy(desc(volunteers.createdAt))
      .limit(limit);
    return rows.map(toVolunteer);
  }

  async setApproved(id: VolunteerId, approved: boolean): Promise<void> {
    await this.#db
      .update(volunteers)
      .set({ approvedAt: approved ? new Date() : null })
      .where(eq(volunteers.id, id));
  }

  async setSuspended(id: VolunteerId, suspended: boolean): Promise<void> {
    await this.#db
      .update(volunteers)
      .set({
        suspendedAt: suspended ? new Date() : null,
        // A suspended volunteer must not keep appearing available to the
        // matcher, so take them offline in the same statement.
        ...(suspended ? { status: "offline" as const } : {}),
      })
      .where(eq(volunteers.id, id));
  }

  async setStatus(id: VolunteerId, status: Volunteer["status"]): Promise<void> {
    await this.#db.update(volunteers).set({ status }).where(eq(volunteers.id, id));
  }

  async create(input: {
    displayName: string;
    email: string;
    passwordHash: string;
    languages: readonly LanguageCode[];
    approved?: boolean;
    applicationNote?: string;
  }): Promise<Volunteer> {
    const rows = await this.#db
      .insert(volunteers)
      .values({
        displayName: input.displayName,
        email: input.email.toLowerCase(),
        passwordHash: input.passwordHash,
        languages: [...input.languages],
        // New volunteers cannot be matched until an admin approves them.
        // Vetting who speaks to seekers is the whole safety model. First-run
        // setup is the one exception, and it can only ever run once.
        approvedAt: input.approved ? new Date() : null,
        applicationNote: input.applicationNote ?? null,
      })
      .returning();

    const row = rows[0];
    if (!row) throw new Error("Insert returned no volunteer row");
    return toVolunteer(row);
  }

  async count(): Promise<number> {
    const rows = await this.#db
      .select({ total: sql<number>`count(*)::int` })
      .from(volunteers);
    return rows[0]?.total ?? 0;
  }

  async passwordHashFor(email: string): Promise<string | null> {
    const rows = await this.#db
      .select({ hash: volunteers.passwordHash })
      .from(volunteers)
      .where(eq(volunteers.email, email.toLowerCase()))
      .limit(1);
    return rows[0]?.hash ?? null;
  }
}

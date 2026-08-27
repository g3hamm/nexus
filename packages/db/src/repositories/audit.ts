import { and, desc, eq, type SQL } from "drizzle-orm";
import type {
  AuditAction,
  AuditEntry,
  AuditLog,
  ConversationId,
  ParticipantRole,
} from "@nexus/core";
import type { NexusDatabase } from "../client.js";
import { auditLog } from "../schema.js";

export class DrizzleAuditLog implements AuditLog {
  readonly #db: NexusDatabase;

  constructor(db: NexusDatabase) {
    this.#db = db;
  }

  async record(entry: Omit<AuditEntry, "occurredAt">): Promise<void> {
    await this.#db.insert(auditLog).values({
      action: entry.action,
      actorRole: entry.actorRole,
      actorId: entry.actorId,
      conversationId: entry.conversationId,
      detail: entry.detail,
    });
  }

  async list(options: {
    conversationId?: ConversationId;
    actorId?: string;
    limit: number;
  }): Promise<readonly AuditEntry[]> {
    const predicates: SQL[] = [];
    if (options.conversationId) {
      predicates.push(eq(auditLog.conversationId, options.conversationId));
    }
    if (options.actorId) {
      predicates.push(eq(auditLog.actorId, options.actorId));
    }

    const base = this.#db.select().from(auditLog);
    const filtered = predicates.length > 0 ? base.where(and(...predicates)) : base;

    const rows = await filtered.orderBy(desc(auditLog.occurredAt)).limit(options.limit);

    return rows.map((row) => ({
      action: row.action as AuditAction,
      actorRole: row.actorRole as ParticipantRole,
      actorId: row.actorId,
      conversationId: (row.conversationId as ConversationId | null) ?? null,
      detail: (row.detail ?? {}) as Record<string, unknown>,
      occurredAt: row.occurredAt,
    }));
  }
}

import type {
  AppendMessageInput,
  AuditEntry,
  AuditLog,
  Conversation,
  ConversationId,
  ConversationRepository,
  CreateConversationInput,
  LanguageCode,
  Message,
  MessageId,
  MessageRepository,
  Rendering,
  Volunteer,
  VolunteerId,
} from "@nexus/core";
import {
  NexusError,
  asConversationId,
  asMessageId,
  asRoomId,
  asVolunteerId,
  sameLanguage,
} from "@nexus/core";

/**
 * In-memory repositories.
 *
 * These let the whole conversation flow be tested without a database, which
 * matters because the flow — detect, match, translate, persist, notify — is
 * where the interesting bugs live, not in the SQL.
 */
export class FakeConversationRepository implements ConversationRepository {
  readonly rows = new Map<string, Conversation>();
  #seq = 0;

  async create(input: CreateConversationInput): Promise<Conversation> {
    const id = asConversationId(`conv-${++this.#seq}`);
    const conversation: Conversation = {
      id,
      seekerId: input.seekerId,
      volunteerId: null,
      status: "waiting",
      roomId: asRoomId(`nexus-${id}`),
      modality: input.modality,
      seekerLanguage: input.seekerLanguage,
      volunteerLanguage: null,
      translationRequired: true,
      startedAt: new Date(),
      matchedAt: null,
      endedAt: null,
      retainUntil: input.retainUntil,
    };
    this.rows.set(id, conversation);
    return conversation;
  }

  async findById(id: ConversationId): Promise<Conversation | null> {
    return this.rows.get(id) ?? null;
  }

  async findWaiting(limit: number): Promise<readonly Conversation[]> {
    return [...this.rows.values()]
      .filter((c) => c.status === "waiting" && c.volunteerId === null)
      .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
      .slice(0, limit);
  }

  async findActiveForVolunteer(
    volunteerId: VolunteerId,
  ): Promise<readonly Conversation[]> {
    return [...this.rows.values()].filter(
      (c) => c.volunteerId === volunteerId && c.status === "active",
    );
  }

  async claim(
    id: ConversationId,
    volunteerId: VolunteerId,
    volunteerLanguage: LanguageCode,
  ): Promise<Conversation | null> {
    const existing = this.rows.get(id);
    // Mirrors the conditional UPDATE in the real repository: only a waiting,
    // unclaimed conversation can be taken, so the second caller gets null.
    if (!existing || existing.status !== "waiting" || existing.volunteerId !== null) {
      return null;
    }
    const claimed: Conversation = {
      ...existing,
      volunteerId,
      volunteerLanguage,
      status: "active",
      matchedAt: new Date(),
      translationRequired: !sameLanguage(existing.seekerLanguage, volunteerLanguage),
    };
    this.rows.set(id, claimed);
    return claimed;
  }

  async end(id: ConversationId, reason: "ended" | "terminated"): Promise<void> {
    const existing = this.rows.get(id);
    if (existing) {
      this.rows.set(id, { ...existing, status: reason, endedAt: new Date() });
    }
  }

  async markUnderReview(id: ConversationId): Promise<void> {
    const existing = this.rows.get(id);
    if (existing) {
      this.rows.set(id, { ...existing, status: "under_review", retainUntil: null });
    }
  }
}

export class FakeMessageRepository implements MessageRepository {
  readonly rows: Message[] = [];
  #seq = 0;

  async append(input: AppendMessageInput): Promise<Message> {
    const message: Message = {
      id: asMessageId(`msg-${++this.#seq}`),
      conversationId: input.conversationId,
      authorRole: input.authorRole,
      authorId: input.authorId,
      originalLanguage: input.originalLanguage,
      renderings: input.renderings,
      // Spread sends apart so ordering is deterministic under a fast test.
      sentAt: new Date(Date.now() + this.#seq),
      flagged: false,
    };
    this.rows.push(message);
    return message;
  }

  async findById(id: MessageId): Promise<Message | null> {
    return this.rows.find((m) => m.id === id) ?? null;
  }

  async listForConversation(
    conversationId: ConversationId,
    options: { after?: Date; limit?: number } = {},
  ): Promise<readonly Message[]> {
    let found = this.rows.filter((m) => m.conversationId === conversationId);
    if (options.after) {
      const after = options.after;
      found = found.filter((m) => m.sentAt > after);
    }
    return options.limit ? found.slice(-options.limit) : found;
  }

  async markFlagged(ids: readonly MessageId[]): Promise<void> {
    for (const id of ids) {
      const index = this.rows.findIndex((m) => m.id === id);
      const existing = this.rows[index];
      if (existing) this.rows[index] = { ...existing, flagged: true };
    }
  }

  async addRendering(id: MessageId, rendering: Rendering): Promise<Message> {
    const index = this.rows.findIndex((m) => m.id === id);
    const existing = this.rows[index];
    if (!existing) throw NexusError.notFound("Message", id);

    const updated: Message = {
      ...existing,
      renderings: [
        ...existing.renderings.filter((r) => r.language !== rendering.language),
        rendering,
      ],
    };
    this.rows[index] = updated;
    return updated;
  }
}

export class FakeAuditLog implements AuditLog {
  readonly entries: AuditEntry[] = [];

  async record(entry: Omit<AuditEntry, "occurredAt">): Promise<void> {
    this.entries.push({ ...entry, occurredAt: new Date() });
  }

  async list(): Promise<readonly AuditEntry[]> {
    return this.entries;
  }
}

export function fakeVolunteer(overrides: Partial<Volunteer> = {}): Volunteer {
  return {
    id: asVolunteerId("vol-1"),
    displayName: "Ana",
    email: "ana@example.org",
    languages: ["en"],
    status: "available",
    maxConcurrentConversations: 1,
    approvedAt: new Date(),
    suspendedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

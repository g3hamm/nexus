import type {
  AppendMessageInput,
  AuditEntry,
  AuditLog,
  ConversationWindow,
  AdminId,
  FlagId,
  FlagRepository,
  Judge,
  ModerationFlag,
  ModerationScheduler,
  ModerationVerdict,
  VolunteerRepository,
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
  asFlagId,
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
      lastModeratedAt: null,
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

  async restoreRetention(id: ConversationId, retainUntil: Date): Promise<void> {
    const existing = this.rows.get(id);
    if (!existing || existing.status !== "under_review") return;
    this.rows.set(id, {
      ...existing,
      retainUntil,
      status: existing.endedAt === null ? "active" : "ended",
    });
  }

  async markModerated(id: ConversationId, at: Date): Promise<void> {
    const existing = this.rows.get(id);
    if (existing) this.rows.set(id, { ...existing, lastModeratedAt: at });
  }

  async findPurgeable(now: Date, limit: number): Promise<readonly ConversationId[]> {
    return [...this.rows.values()]
      .filter(
        (c) =>
          (c.status === "ended" || c.status === "terminated") &&
          c.retainUntil !== null &&
          c.retainUntil < now &&
          !this.openFlagFor.has(c.id),
      )
      .sort((a, b) => (a.retainUntil?.getTime() ?? 0) - (b.retainUntil?.getTime() ?? 0))
      .slice(0, limit)
      .map((c) => c.id);
  }

  async purge(ids: readonly ConversationId[]): Promise<number> {
    let removed = 0;
    for (const id of ids) {
      if (this.rows.delete(id)) removed += 1;
    }
    return removed;
  }

  /** Test hook: stands in for the "has an unresolved flag" exclusion. */
  readonly openFlagFor = new Set<string>();
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

export class FakeFlagRepository implements FlagRepository {
  readonly raised: ModerationFlag[] = [];
  #seq = 0;

  async raise(
    conversationId: ConversationId,
    verdict: ModerationVerdict,
  ): Promise<ModerationFlag> {
    const flag: ModerationFlag = {
      id: asFlagId(`flag-${++this.#seq}`),
      conversationId,
      verdict,
      status: "open",
      raisedAt: new Date(),
      reviewedBy: null,
      reviewedAt: null,
      reviewNote: null,
    };
    this.raised.push(flag);
    return flag;
  }

  async findById(id: FlagId): Promise<ModerationFlag | null> {
    return this.raised.find((f) => f.id === id) ?? null;
  }

  async listOpen(limit: number): Promise<readonly ModerationFlag[]> {
    return this.raised.filter((f) => f.status === "open").slice(0, limit);
  }

  async listResolved(limit: number): Promise<readonly ModerationFlag[]> {
    return this.raised
      .filter((f) => f.status === "upheld" || f.status === "dismissed")
      .slice(0, limit);
  }

  async listForConversation(
    conversationId: ConversationId,
  ): Promise<readonly ModerationFlag[]> {
    return this.raised.filter((f) => f.conversationId === conversationId);
  }

  async resolve(
    id: FlagId,
    adminId: AdminId,
    status: "upheld" | "dismissed",
    note: string,
  ): Promise<void> {
    const index = this.raised.findIndex((f) => f.id === id);
    const existing = this.raised[index];
    if (!existing) return;
    this.raised[index] = {
      ...existing,
      status,
      reviewedBy: adminId,
      reviewedAt: new Date(),
      reviewNote: note,
    };
  }
}

export class FakeVolunteerRepository implements VolunteerRepository {
  readonly rows = new Map<string, Volunteer>();

  add(volunteer: Volunteer): Volunteer {
    this.rows.set(volunteer.id, volunteer);
    return volunteer;
  }

  async findById(id: VolunteerId): Promise<Volunteer | null> {
    return this.rows.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<Volunteer | null> {
    return [...this.rows.values()].find((v) => v.email === email.toLowerCase()) ?? null;
  }

  async findAvailable(): Promise<readonly Volunteer[]> {
    return [...this.rows.values()].filter(
      (v) => v.status === "available" && v.approvedAt !== null && v.suspendedAt === null,
    );
  }

  async listAll(limit: number): Promise<readonly Volunteer[]> {
    return [...this.rows.values()].slice(0, limit);
  }

  async setApproved(id: VolunteerId, approved: boolean): Promise<void> {
    const existing = this.rows.get(id);
    if (existing) {
      this.rows.set(id, { ...existing, approvedAt: approved ? new Date() : null });
    }
  }

  async setSuspended(id: VolunteerId, suspended: boolean): Promise<void> {
    const existing = this.rows.get(id);
    if (existing) {
      this.rows.set(id, {
        ...existing,
        suspendedAt: suspended ? new Date() : null,
        ...(suspended ? { status: "offline" as const } : {}),
      });
    }
  }

  async setStatus(id: VolunteerId, status: Volunteer["status"]): Promise<void> {
    const existing = this.rows.get(id);
    if (existing) this.rows.set(id, { ...existing, status });
  }

  async create(input: {
    displayName: string;
    email: string;
    passwordHash: string;
    languages: readonly LanguageCode[];
    approved?: boolean;
  }): Promise<Volunteer> {
    return this.add(
      fakeVolunteer({
        id: asVolunteerId(`vol-${this.rows.size + 1}`),
        displayName: input.displayName,
        email: input.email.toLowerCase(),
        languages: input.languages,
        approvedAt: input.approved ? new Date() : null,
      }),
    );
  }

  async passwordHashFor(): Promise<string | null> {
    return null;
  }

  async count(): Promise<number> {
    return this.rows.size;
  }
}

/** A judge that returns whatever the test tells it to. */
export class StubJudge implements Judge {
  readonly name = "stub";
  readonly reviews: ConversationWindow[] = [];
  #verdict: ModerationVerdict = {
    category: null,
    severity: "none",
    subject: "unclear",
    rationale: "Nothing of concern.",
    action: "none",
    evidenceMessageIds: [],
    confidence: 0.99,
  };

  willReturn(verdict: Partial<ModerationVerdict>): this {
    this.#verdict = { ...this.#verdict, ...verdict };
    return this;
  }

  async review(window: ConversationWindow): Promise<ModerationVerdict> {
    this.reviews.push(window);
    return this.#verdict;
  }
}

/** A scheduler the test drives directly. */
export class StubScheduler implements ModerationScheduler {
  constructor(private readonly answer: boolean) {}
  shouldReview(): boolean {
    return this.answer;
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
    applicationNote: null,
    createdAt: new Date(),
    ...overrides,
  };
}

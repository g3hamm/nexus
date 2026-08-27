import type {
  AdminId,
  ConversationId,
  FlagId,
  MessageId,
  SeekerId,
  VolunteerId,
} from "../domain/ids.js";
import type { LanguageCode } from "../domain/language.js";
import type { Conversation, Modality } from "../domain/conversation.js";
import type { Message, Rendering } from "../domain/message.js";
import type { ModerationFlag, ModerationVerdict } from "../domain/moderation.js";
import type { ParticipantRole, Volunteer } from "../domain/participants.js";

/**
 * Persistence contracts.
 *
 * Repositories take and return domain objects in the clear. Encryption
 * happens inside the implementation, at the database boundary, so that no
 * caller can forget to encrypt and nothing above this line handles ciphertext.
 */

export interface CreateConversationInput {
  readonly seekerId: SeekerId;
  readonly seekerLanguage: LanguageCode;
  readonly modality: Modality;
  readonly retainUntil: Date | null;
}

export interface AppendMessageInput {
  readonly conversationId: ConversationId;
  readonly authorRole: ParticipantRole;
  readonly authorId: string | null;
  readonly originalLanguage: LanguageCode;
  readonly renderings: readonly Rendering[];
}

export interface ConversationRepository {
  create(input: CreateConversationInput): Promise<Conversation>;
  findById(id: ConversationId): Promise<Conversation | null>;
  /** Oldest waiting conversations first, so nobody is left sitting. */
  findWaiting(limit: number): Promise<readonly Conversation[]>;
  findActiveForVolunteer(volunteerId: VolunteerId): Promise<readonly Conversation[]>;
  /**
   * Atomically claim a waiting conversation for a volunteer.
   * Returns null if another volunteer got there first.
   */
  claim(
    id: ConversationId,
    volunteerId: VolunteerId,
    volunteerLanguage: LanguageCode,
  ): Promise<Conversation | null>;
  end(id: ConversationId, reason: "ended" | "terminated"): Promise<void>;
  markUnderReview(id: ConversationId): Promise<void>;
}

export interface MessageRepository {
  append(input: AppendMessageInput): Promise<Message>;
  findById(id: MessageId): Promise<Message | null>;
  /** Chronological. `after` supports incremental fetch on reconnect. */
  listForConversation(
    conversationId: ConversationId,
    options?: { readonly after?: Date; readonly limit?: number },
  ): Promise<readonly Message[]>;
  markFlagged(ids: readonly MessageId[]): Promise<void>;
  /**
   * Add a rendering to an existing message.
   *
   * Needed when a volunteer joins a conversation the seeker has already been
   * talking in: everything said while they waited has to be translated into
   * the volunteer's language after the fact. Replaces an existing rendering
   * for the same language rather than accumulating duplicates.
   */
  addRendering(id: MessageId, rendering: Rendering): Promise<Message>;
}

export interface VolunteerRepository {
  findById(id: VolunteerId): Promise<Volunteer | null>;
  findByEmail(email: string): Promise<Volunteer | null>;
  /** Approved, unsuspended, available, and under their concurrency cap. */
  findAvailable(language?: LanguageCode): Promise<readonly Volunteer[]>;
  setStatus(id: VolunteerId, status: Volunteer["status"]): Promise<void>;
  create(input: {
    readonly displayName: string;
    readonly email: string;
    readonly passwordHash: string;
    readonly languages: readonly LanguageCode[];
  }): Promise<Volunteer>;
  /** Returns the stored hash, or null if there is no such volunteer. */
  passwordHashFor(email: string): Promise<string | null>;
}

export interface FlagRepository {
  raise(
    conversationId: ConversationId,
    verdict: ModerationVerdict,
  ): Promise<ModerationFlag>;
  findById(id: FlagId): Promise<ModerationFlag | null>;
  listOpen(limit: number): Promise<readonly ModerationFlag[]>;
  resolve(
    id: FlagId,
    adminId: AdminId,
    status: "upheld" | "dismissed",
    note: string,
  ): Promise<void>;
}

/**
 * Every consequential action, including every admin read of a transcript.
 *
 * "All conversations are auditable by admins" and "admins are themselves
 * audited" have to be the same feature, or the audit trail protects only the
 * people who are not looking at it.
 */
export type AuditAction =
  | "conversation.started"
  | "conversation.matched"
  | "conversation.ended"
  | "conversation.viewed"
  | "conversation.exported"
  | "flag.raised"
  | "flag.resolved"
  | "volunteer.approved"
  | "volunteer.suspended"
  | "knowledge.updated"
  | "auth.login"
  | "auth.failed";

export interface AuditEntry {
  readonly action: AuditAction;
  readonly actorRole: ParticipantRole;
  readonly actorId: string | null;
  readonly conversationId: ConversationId | null;
  readonly detail: Readonly<Record<string, unknown>>;
  readonly occurredAt: Date;
}

export interface AuditLog {
  record(entry: Omit<AuditEntry, "occurredAt">): Promise<void>;
  list(options: {
    readonly conversationId?: ConversationId;
    readonly actorId?: string;
    readonly limit: number;
  }): Promise<readonly AuditEntry[]>;
}

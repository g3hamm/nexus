import type {
  AdminId,
  ConversationId,
  FlagId,
  MessageId,
  SeekerId,
  VolunteerId,
} from "../domain/ids.js";
import type { LanguageCode } from "../domain/language.js";
import type { Coverage } from "../domain/coverage.js";
import type { Conversation, Modality } from "../domain/conversation.js";
import type { Message, Rendering } from "../domain/message.js";
import type { ModerationFlag, ModerationVerdict } from "../domain/moderation.js";
import type { Admin, ParticipantRole, Volunteer } from "../domain/participants.js";

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
  /** Stamps when the judge last looked, so the cadence can be computed. */
  markModerated(id: ConversationId, at: Date): Promise<void>;
  /**
   * Records that someone in this conversation may be at risk of harm.
   *
   * Set-once: implementations must ignore a second call, so the timestamp
   * keeps meaning "when we first knew" instead of creeping forward with
   * every later review. What it drives is the crisis card — which is why it
   * lives on the conversation rather than only on the flag. A seeker whose
   * phone drops the connection and who comes back five minutes later should
   * still find the numbers there.
   */
  markCrisis(id: ConversationId, at: Date): Promise<void>;

  /**
   * Puts a conversation back on a retention clock after review, and returns
   * it to a normal status.
   *
   * `markUnderReview` nulls `retainUntil`, which exempts the conversation from
   * the purge. Without this counterpart, every flag the judge raises would
   * keep a transcript forever — quietly undoing the retention policy one
   * flag at a time.
   */
  restoreRetention(id: ConversationId, retainUntil: Date): Promise<void>;

  /**
   * Conversations whose retention window has closed and which are safe to
   * destroy: ended, past `retainUntil`, not under review, and carrying no
   * unresolved moderation flag.
   *
   * Returns a bounded batch rather than everything, so a purge that has been
   * missed for a month does not try to delete a year of history in one
   * statement.
   */
  findPurgeable(now: Date, limit: number): Promise<readonly ConversationId[]>;

  /**
   * Destroys conversations and everything belonging to them. Returns the
   * number removed.
   *
   * A hard delete, deliberately. See the implementation for why nothing
   * softer would actually protect anyone.
   */
  purge(ids: readonly ConversationId[]): Promise<number>;
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
  /** Everyone, for the admin roster. Newest first. */
  listAll(limit: number): Promise<readonly Volunteer[]>;
  /** Approve or un-approve. Approval is what lets a volunteer be matched. */
  setApproved(id: VolunteerId, approved: boolean): Promise<void>;
  /** Suspend or reinstate. Suspension survives re-approval. */
  setSuspended(id: VolunteerId, suspended: boolean): Promise<void>;
  setStatus(id: VolunteerId, status: Volunteer["status"]): Promise<void>;
  create(input: {
    readonly displayName: string;
    readonly email: string;
    readonly passwordHash: string;
    readonly languages: readonly LanguageCode[];
    /**
     * Approve on creation. Only first-run setup and the seed script do this —
     * the normal path leaves a volunteer unapproved until an admin vets them,
     * which is the actual safety model.
     */
    readonly approved?: boolean;
    /** What the applicant wrote about themselves, for whoever vets them. */
    readonly applicationNote?: string;
  }): Promise<Volunteer>;
  /** Returns the stored hash, or null if there is no such volunteer. */
  passwordHashFor(email: string): Promise<string | null>;
  /** Total volunteers, approved or not. Used to gate first-run setup. */
  count(): Promise<number>;
  /**
   * Who is actually on, right now.
   *
   * One query rather than `findAvailable().length`, because this runs on the
   * landing page of a site meant to be the calmest thing a distressed person
   * opens all day, and because the answer needs "online but busy" — a state
   * `findAvailable` cannot express.
   */
  coverage(): Promise<Coverage>;

  /**
   * Issues a one-time password reset.
   *
   * Nexus has no email provider, so nothing is sent — an administrator is
   * shown the code once and passes it on however they already communicate
   * with the person. For a small vetted volunteer base that is workable, and
   * arguably safer than a link in an inbox.
   */
  issuePasswordReset(id: VolunteerId, codeHash: string, expiresAt: Date): Promise<void>;
  /** The pending reset for an email, if there is one. */
  pendingResetFor(email: string): Promise<{
    readonly id: VolunteerId;
    readonly codeHash: string;
    readonly expiresAt: Date;
  } | null>;
  /** Sets the new password and clears the reset in one step. */
  completePasswordReset(id: VolunteerId, passwordHash: string): Promise<void>;
}

/**
 * An admin's second-factor state.
 *
 * Enrolled and enabled are separate on purpose: a secret is written when the
 * QR code is shown, but MFA only takes effect once a code has been verified.
 * Otherwise a half-finished setup locks someone out of their own account.
 */
export interface AdminMfa {
  /** Encrypted TOTP seed, or null if never enrolled. */
  readonly sealedSecret: string | null;
  /** Null until a code proved the app is set up correctly. */
  readonly enabledAt: Date | null;
  readonly recoveryCodeHashes: readonly string[];
}

export interface AdminRepository {
  findById(id: AdminId): Promise<Admin | null>;
  findByEmail(email: string): Promise<Admin | null>;
  create(input: {
    readonly displayName: string;
    readonly email: string;
    readonly passwordHash: string;
  }): Promise<Admin>;
  /** Returns the stored hash, or null if there is no such admin. */
  passwordHashFor(email: string): Promise<string | null>;
  count(): Promise<number>;

  mfaFor(id: AdminId): Promise<AdminMfa | null>;
  /** Writes the secret without enabling. See `AdminMfa`. */
  beginMfaEnrolment(id: AdminId, sealedSecret: string): Promise<void>;
  /** Takes effect now. Replaces any previous recovery codes. */
  completeMfaEnrolment(id: AdminId, recoveryCodeHashes: readonly string[]): Promise<void>;
  disableMfa(id: AdminId): Promise<void>;
  /** Replaces the stored set, so a used code cannot be used again. */
  setRecoveryCodeHashes(id: AdminId, hashes: readonly string[]): Promise<void>;
  setPasswordHash(id: AdminId, passwordHash: string): Promise<void>;
}

export interface FlagRepository {
  raise(
    conversationId: ConversationId,
    verdict: ModerationVerdict,
  ): Promise<ModerationFlag>;
  findById(id: FlagId): Promise<ModerationFlag | null>;
  listOpen(limit: number): Promise<readonly ModerationFlag[]>;
  /** Recently resolved flags, newest first, so decisions can be reviewed. */
  listResolved(limit: number): Promise<readonly ModerationFlag[]>;
  /** Every flag on one conversation, for the review screen. */
  listForConversation(conversationId: ConversationId): Promise<readonly ModerationFlag[]>;
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
  | "conversation.purged"
  | "flag.raised"
  | "flag.resolved"
  | "volunteer.applied"
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

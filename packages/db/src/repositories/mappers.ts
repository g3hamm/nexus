import type { Conversation, Message, Rendering, Volunteer } from "@nexus/core";
import {
  asConversationId,
  asMessageId,
  asRoomId,
  asSeekerId,
  asVolunteerId,
} from "@nexus/core";
import type { conversations, messages, volunteers } from "../schema.js";

type ConversationRow = typeof conversations.$inferSelect;
type MessageRow = typeof messages.$inferSelect;
type VolunteerRow = typeof volunteers.$inferSelect;

export function toConversation(row: ConversationRow): Conversation {
  return {
    id: asConversationId(row.id),
    seekerId: asSeekerId(row.seekerId),
    volunteerId: row.volunteerId ? asVolunteerId(row.volunteerId) : null,
    status: row.status,
    roomId: asRoomId(row.roomId),
    modality: row.modality,
    seekerLanguage: row.seekerLanguage,
    volunteerLanguage: row.volunteerLanguage,
    translationRequired: row.translationRequired,
    startedAt: row.startedAt,
    matchedAt: row.matchedAt,
    lastModeratedAt: row.lastModeratedAt,
    endedAt: row.endedAt,
    retainUntil: row.retainUntil,
  };
}

export function toVolunteer(row: VolunteerRow): Volunteer {
  return {
    id: asVolunteerId(row.id),
    displayName: row.displayName,
    email: row.email,
    languages: row.languages,
    status: row.status,
    maxConcurrentConversations: row.maxConcurrentConversations,
    approvedAt: row.approvedAt,
    suspendedAt: row.suspendedAt,
    applicationNote: row.applicationNote,
    createdAt: row.createdAt,
  };
}

/** Renderings arrive already decrypted — the repository does that, not this. */
export function toMessage(row: MessageRow, renderings: readonly Rendering[]): Message {
  return {
    id: asMessageId(row.id),
    conversationId: asConversationId(row.conversationId),
    authorRole: row.authorRole,
    authorId: row.authorId,
    originalLanguage: row.originalLanguage,
    renderings,
    sentAt: row.sentAt,
    flagged: row.flagged,
  };
}

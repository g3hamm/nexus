import type { ConversationId, RoomId } from "../domain/ids.js";
import type { ParticipantRole } from "../domain/participants.js";
import type { Modality } from "../domain/conversation.js";

/**
 * The realtime transport, expressed as rooms and participants rather than
 * as messages.
 *
 * This shape is the reason adding video later is a configuration change.
 * A text conversation is a room where participants hold `canPublishData`.
 * A video call is the same room, the same participants, the same matching
 * and moderation, with `canPublishVideo` also granted. Nothing above this
 * port needs to learn a new concept.
 */

export interface RoomHandle {
  readonly roomId: RoomId;
  readonly conversationId: ConversationId;
  readonly createdAt: Date;
}

/**
 * What a participant is allowed to do in a room.
 *
 * Grant the narrowest set that the conversation's modality requires — tokens
 * are handed to browsers, and a seeker's token should not be able to start
 * publishing video into a text conversation.
 */
export interface ParticipantCapabilities {
  readonly canPublishData: boolean;
  readonly canPublishAudio: boolean;
  readonly canPublishVideo: boolean;
  readonly canSubscribe: boolean;
}

export function capabilitiesFor(modality: Modality): ParticipantCapabilities {
  return {
    canPublishData: true,
    canPublishAudio: modality === "audio" || modality === "video",
    canPublishVideo: modality === "video",
    canSubscribe: true,
  };
}

export interface IssueTokenInput {
  readonly roomId: RoomId;
  /** Stable within a room; how the other side identifies this participant. */
  readonly participantId: string;
  readonly role: ParticipantRole;
  /** Shown to the other party. Never a seeker's real name — they have none. */
  readonly displayName: string;
  readonly capabilities: ParticipantCapabilities;
  readonly ttlSeconds: number;
}

export interface AccessGrant {
  readonly token: string;
  /** Where the client should connect. Provider-specific. */
  readonly url: string;
  readonly expiresAt: Date;
}

/**
 * Events broadcast over the room's data channel.
 *
 * Deliberately small and versioned. Anything that must survive a refresh is
 * persisted by the server as well — the transport is for liveness, the
 * database is the record.
 */
export type RealtimeEvent =
  | { readonly type: "message"; readonly messageId: string; readonly sentAt: string }
  | { readonly type: "typing"; readonly role: ParticipantRole; readonly active: boolean }
  | {
      readonly type: "presence";
      readonly role: ParticipantRole;
      readonly joined: boolean;
    }
  | { readonly type: "conversation_ended"; readonly reason: string }
  | {
      readonly type: "moderation_notice";
      readonly severity: string;
      readonly text: string;
    };

export interface CreateRoomInput {
  readonly conversationId: ConversationId;
  readonly modality: Modality;
  /** Room is torn down this long after the last participant leaves. */
  readonly emptyTimeoutSeconds?: number;
}

export interface RealtimeTransport {
  readonly name: string;
  createRoom(input: CreateRoomInput): Promise<RoomHandle>;
  issueAccessToken(input: IssueTokenInput): Promise<AccessGrant>;
  /** Server-originated broadcast, e.g. telling both clients a message landed. */
  publishEvent(roomId: RoomId, event: RealtimeEvent): Promise<void>;
  closeRoom(roomId: RoomId): Promise<void>;
}

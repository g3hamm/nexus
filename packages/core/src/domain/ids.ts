/**
 * Branded ID types.
 *
 * These are plain strings at runtime but distinct at compile time, so a
 * `VolunteerId` can never be passed where a `ConversationId` is expected.
 * Cheap insurance in a codebase that several teams will touch.
 */

declare const brand: unique symbol;

type Brand<T, B extends string> = T & { readonly [brand]: B };

export type ConversationId = Brand<string, "ConversationId">;
export type MessageId = Brand<string, "MessageId">;
export type VolunteerId = Brand<string, "VolunteerId">;
export type SeekerId = Brand<string, "SeekerId">;
export type AdminId = Brand<string, "AdminId">;
export type FlagId = Brand<string, "FlagId">;
export type RoomId = Brand<string, "RoomId">;
export type DocumentId = Brand<string, "DocumentId">;
export type ChunkId = Brand<string, "ChunkId">;

export const asConversationId = (v: string): ConversationId => v as ConversationId;
export const asMessageId = (v: string): MessageId => v as MessageId;
export const asVolunteerId = (v: string): VolunteerId => v as VolunteerId;
export const asSeekerId = (v: string): SeekerId => v as SeekerId;
export const asAdminId = (v: string): AdminId => v as AdminId;
export const asFlagId = (v: string): FlagId => v as FlagId;
export const asRoomId = (v: string): RoomId => v as RoomId;
export const asDocumentId = (v: string): DocumentId => v as DocumentId;
export const asChunkId = (v: string): ChunkId => v as ChunkId;

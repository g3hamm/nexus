/**
 * @nexus/db — Neon Postgres persistence.
 *
 * Repositories take and return plain domain objects. Encryption happens
 * inside them, so there is no code path that writes readable transcript data
 * to the database.
 */
export { createDatabase, type NexusDatabase } from "./client.js";
export * as schema from "./schema.js";
export { EMBEDDING_DIMENSIONS } from "./schema.js";
export { DrizzleConversationRepository } from "./repositories/conversations.js";
export { DrizzleMessageRepository } from "./repositories/messages.js";
export { DrizzleVolunteerRepository } from "./repositories/volunteers.js";
export { DrizzleFlagRepository } from "./repositories/flags.js";
export { DrizzleAuditLog } from "./repositories/audit.js";
export { DrizzleAdminRepository } from "./repositories/admins.js";

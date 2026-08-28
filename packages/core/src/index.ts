/**
 * @nexus/core — the domain model and every module contract in Nexus.
 *
 * Rules of the road for this package:
 *   1. It depends on nothing but zod. No database, no HTTP, no provider SDKs.
 *   2. Everything else in the monorepo depends on it, and never the reverse.
 *   3. Adding a capability means adding a port here first, then implementing
 *      it in its own package. That is what keeps the pieces swappable.
 */

// ── Domain ──────────────────────────────────────────────────────────────────
export * from "./domain/ids.js";
export * from "./domain/language.js";
export * from "./domain/participants.js";
export * from "./domain/conversation.js";
export * from "./domain/message.js";
export * from "./domain/moderation.js";
export * from "./domain/crisis.js";
export * from "./domain/scripture.js";
export * from "./domain/doctrine.js";

// ── Ports ───────────────────────────────────────────────────────────────────
export * from "./ports/llm.js";
export * from "./ports/translation.js";
export * from "./ports/realtime.js";
export * from "./ports/bible.js";
export * from "./ports/knowledge.js";
export * from "./ports/enablement.js";
export * from "./ports/moderation.js";
export * from "./ports/alerts.js";
export * from "./ports/crypto.js";
export * from "./ports/repositories.js";
export * from "./ports/matching.js";
export * from "./ports/clock.js";
export * from "./ports/rate-limit.js";

// ── Errors ──────────────────────────────────────────────────────────────────
export * from "./errors.js";

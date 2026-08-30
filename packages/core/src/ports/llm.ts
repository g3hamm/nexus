import type { z } from "zod";

/**
 * The single seam every AI feature in Nexus goes through.
 *
 * Nothing above this line knows what model is answering. Translation, the
 * enablement sidebar, and the judge all speak to this interface, so swapping
 * providers is one factory change rather than a sweep through the codebase.
 */

export interface LlmMessage {
  readonly role: "user" | "assistant";
  readonly content: string;
}

/**
 * Named jobs rather than named models.
 *
 * Call sites ask for `"translation"`, not for a specific model, and a router
 * maps tasks to models. That lets an operator send translation to something
 * cheap and the judge to something careful without touching feature code.
 */
export type LlmTask =
  | "translation"
  | "language_detection"
  | "enablement"
  /** Verses only, run automatically and often — see `EnablementEngine.suggestVerses`. */
  | "enablement_verses"
  | "moderation"
  | "knowledge_synthesis"
  /** Playing the difficult seeker in a volunteer's practice session. */
  | "practice"
  /** Marking that practice session afterwards. */
  | "practice_debrief";

export type LlmEffort = "low" | "medium" | "high";

export interface LlmRequest {
  readonly task: LlmTask;
  /**
   * Stable instructions. Keep volatile content (timestamps, ids, the current
   * message) out of here and in `messages` — this string is the cache prefix,
   * and a byte of churn in it throws away the whole cached prefix.
   */
  readonly system?: string;
  readonly messages: readonly LlmMessage[];
  readonly maxTokens?: number;
  readonly effort?: LlmEffort;
  /** Abort signal so a slow model can't hold a chat turn open forever. */
  readonly signal?: AbortSignal;
}

export interface LlmStructuredRequest<T> extends LlmRequest {
  /** Result is validated against this before any caller sees it. */
  readonly schema: z.ZodType<T>;
  /** Short name for the shape, used in prompts and error messages. */
  readonly schemaName: string;
}

export interface TokenUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedInputTokens: number;
}

export interface LlmResult {
  readonly text: string;
  readonly model: string;
  readonly usage: TokenUsage;
  readonly stopReason: string;
  /** True when the provider declined on safety grounds rather than answering. */
  readonly refused: boolean;
}

export interface LlmStructuredResult<T> {
  readonly value: T;
  readonly model: string;
  readonly usage: TokenUsage;
  /** How many attempts it took to get schema-valid output. 1 means first try. */
  readonly attempts: number;
}

export interface LlmStreamChunk {
  readonly type: "text" | "done";
  readonly text: string;
}

export interface LlmProvider {
  /** Stable identifier, e.g. "anthropic". Recorded on translations for audit. */
  readonly name: string;

  complete(request: LlmRequest): Promise<LlmResult>;

  /**
   * Complete and validate against a schema, retrying on invalid output.
   *
   * Every non-conversational flow in Nexus uses this rather than `complete`.
   * Parsing prose out of a model is where "sturdy" flows go to die.
   */
  completeStructured<T>(
    request: LlmStructuredRequest<T>,
  ): Promise<LlmStructuredResult<T>>;

  stream(request: LlmRequest): AsyncIterable<LlmStreamChunk>;
}

/** Maps a task to the model that should serve it. */
export interface LlmModelRouter {
  modelFor(task: LlmTask): string;
}

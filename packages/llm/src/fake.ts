import type {
  LlmProvider,
  LlmRequest,
  LlmResult,
  LlmStreamChunk,
  LlmStructuredRequest,
  LlmStructuredResult,
  LlmTask,
} from "@nexus/core";
import { NexusError } from "@nexus/core";

/**
 * A scriptable LLM for tests and for running Nexus without an API key.
 *
 * Two jobs. It makes the AI flows testable without spending money or waiting
 * on a network. And it lets a new contributor clone the repo and see the whole
 * app work end to end before they have credentials for anything — which
 * matters a lot for a project about to be handed to a larger team.
 */

export interface ScriptedResponse {
  readonly task?: LlmTask;
  /** Matched against the last user message. */
  readonly when?: (lastUserMessage: string) => boolean;
  readonly text?: string;
  readonly value?: unknown;
}

export class FakeLlmProvider implements LlmProvider {
  readonly name = "fake";
  readonly #script: ScriptedResponse[] = [];
  /** Every request this provider saw, so tests can assert on prompts. */
  readonly calls: LlmRequest[] = [];

  /** Register a canned response. Later registrations win over earlier ones. */
  on(response: ScriptedResponse): this {
    this.#script.unshift(response);
    return this;
  }

  async complete(request: LlmRequest): Promise<LlmResult> {
    this.calls.push(request);
    const match = this.#match(request);
    return {
      text: match?.text ?? "",
      model: "fake-model",
      usage: { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 },
      stopReason: "end_turn",
      refused: false,
    };
  }

  async completeStructured<T>(
    request: LlmStructuredRequest<T>,
  ): Promise<LlmStructuredResult<T>> {
    this.calls.push(request);
    const match = this.#match(request);

    if (match?.value === undefined) {
      throw new NexusError(
        "provider_unavailable",
        `FakeLlmProvider has no scripted value for task "${request.task}" ` +
          `(schema ${request.schemaName}). Register one with .on({ task, value }).`,
      );
    }

    // Validate the fixture against the real schema. A test that passes with a
    // fixture the production schema would reject is worse than no test.
    const parsed = request.schema.safeParse(match.value);
    if (!parsed.success) {
      throw new NexusError(
        "validation_failed",
        `Scripted value does not satisfy ${request.schemaName}: ${parsed.error.message}`,
      );
    }

    return {
      value: parsed.data,
      model: "fake-model",
      usage: { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 },
      attempts: 1,
    };
  }

  async *stream(request: LlmRequest): AsyncIterable<LlmStreamChunk> {
    this.calls.push(request);
    const text = this.#match(request)?.text ?? "";
    for (const word of text.split(/(\s+)/)) {
      if (word) yield { type: "text", text: word };
    }
    yield { type: "done", text: "" };
  }

  #match(request: LlmRequest): ScriptedResponse | undefined {
    const lastUser = [...request.messages].reverse().find((m) => m.role === "user");
    const content = lastUser?.content ?? "";
    return this.#script.find(
      (s) =>
        (s.task === undefined || s.task === request.task) &&
        (s.when === undefined || s.when(content)),
    );
  }

  reset(): void {
    this.#script.length = 0;
    this.calls.length = 0;
  }
}

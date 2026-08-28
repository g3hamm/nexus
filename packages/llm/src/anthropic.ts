import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type {
  LlmProvider,
  LlmRequest,
  LlmResult,
  LlmStreamChunk,
  LlmStructuredRequest,
  LlmStructuredResult,
  LlmModelRouter,
  TokenUsage,
} from "@nexus/core";
import { NexusError } from "@nexus/core";
import { modelCapabilities, StaticModelRouter, TASK_DEFAULTS } from "./models.js";

/**
 * Server-side refusal fallback.
 *
 * Worth having here specifically: the judge is asked to reason about
 * self-harm, sexual content, and threats in order to flag them. That is
 * exactly the shape of request a safety classifier may decline. Without a
 * fallback a declined moderation call means the conversation goes unwatched,
 * which is the failure we least want.
 */
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export interface AnthropicProviderOptions {
  readonly apiKey?: string;
  readonly router?: LlmModelRouter;
  /** How many times to re-ask when structured output fails validation. */
  readonly maxStructuredAttempts?: number;
  readonly client?: Anthropic;
}

export class AnthropicProvider implements LlmProvider {
  readonly name = "anthropic";
  readonly #client: Anthropic;
  readonly #router: LlmModelRouter;
  readonly #maxAttempts: number;

  constructor(options: AnthropicProviderOptions = {}) {
    this.#client =
      options.client ?? new Anthropic(options.apiKey ? { apiKey: options.apiKey } : {});
    this.#router = options.router ?? new StaticModelRouter();
    this.#maxAttempts = options.maxStructuredAttempts ?? 3;
  }

  async complete(request: LlmRequest): Promise<LlmResult> {
    const defaults = TASK_DEFAULTS[request.task];
    const model = this.#router.modelFor(request.task);

    try {
      const response = await this.#client.beta.messages.create(
        {
          model,
          max_tokens: request.maxTokens ?? defaults.maxTokens,
          ...(request.system ? { system: cacheableSystem(request.system) } : {}),
          messages: request.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          ...reasoning(model, request.effort ?? defaults.effort),
        },
        request.signal ? { signal: request.signal } : {},
      );

      return {
        text: textOf(response.content),
        model: response.model,
        usage: usageOf(response.usage),
        stopReason: response.stop_reason ?? "end_turn",
        refused: response.stop_reason === "refusal",
      };
    } catch (error) {
      throw translateError(error, model);
    }
  }

  /**
   * Ask for a value that matches a schema, and keep asking until it does.
   *
   * The retry loop is the "sturdy and unwavering" requirement made concrete.
   * A flow that parses prose out of a model breaks the first time the model
   * writes a preamble; a flow that validates and re-asks does not.
   */
  async completeStructured<T>(
    request: LlmStructuredRequest<T>,
  ): Promise<LlmStructuredResult<T>> {
    const defaults = TASK_DEFAULTS[request.task];
    const model = this.#router.modelFor(request.task);

    const messages: Anthropic.Beta.BetaMessageParam[] = request.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    let lastProblem = "";

    for (let attempt = 1; attempt <= this.#maxAttempts; attempt++) {
      try {
        const response = await this.#client.beta.messages.parse(
          {
            model,
            max_tokens: request.maxTokens ?? defaults.maxTokens,
            ...(request.system ? { system: cacheableSystem(request.system) } : {}),
            messages,
            ...reasoning(model, request.effort ?? defaults.effort, {
              format: betaZodOutputFormat(request.schema),
            }),
          },
          request.signal ? { signal: request.signal } : {},
        );

        if (response.stop_reason === "refusal") {
          throw new NexusError(
            "provider_refused",
            `Model declined the ${request.schemaName} request`,
            { model, category: response.stop_details?.category ?? null },
          );
        }

        const parsed = response.parsed_output;
        if (parsed !== null && parsed !== undefined) {
          // Validate ourselves too. The helper parses; this proves the shape
          // against our own schema rather than trusting the round trip.
          const check = request.schema.safeParse(parsed);
          if (check.success) {
            return {
              value: check.data,
              model: response.model,
              usage: usageOf(response.usage),
              attempts: attempt,
            };
          }
          lastProblem = check.error.issues
            .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
            .join("; ");
        } else {
          lastProblem = "response contained no parseable output";
        }

        // Feed the failure back so the next attempt can correct it.
        messages.push(
          { role: "assistant", content: textOf(response.content) || "(no output)" },
          {
            role: "user",
            content:
              `That did not match the required ${request.schemaName} shape: ` +
              `${lastProblem}. Reply again with only valid ${request.schemaName} data.`,
          },
        );
      } catch (error) {
        if (error instanceof NexusError) throw error;
        // Rate limits and overload are worth another attempt; bad requests are not.
        const wrapped = translateError(error, model);
        if (wrapped.code === "validation_failed" || attempt === this.#maxAttempts) {
          throw wrapped;
        }
        lastProblem = wrapped.message;
      }
    }

    throw new NexusError(
      "provider_unavailable",
      `Could not get valid ${request.schemaName} output after ${this.#maxAttempts} attempts`,
      { model, lastProblem },
    );
  }

  async *stream(request: LlmRequest): AsyncIterable<LlmStreamChunk> {
    const defaults = TASK_DEFAULTS[request.task];
    const model = this.#router.modelFor(request.task);

    const stream = this.#client.beta.messages.stream(
      {
        model,
        max_tokens: request.maxTokens ?? defaults.maxTokens,
        ...(request.system ? { system: cacheableSystem(request.system) } : {}),
        messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
        ...reasoning(model, request.effort ?? defaults.effort, undefined, {
          fallbacks: false,
        }),
      },
      request.signal ? { signal: request.signal } : {},
    );

    try {
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          yield { type: "text", text: event.delta.text };
        }
      }
      yield { type: "done", text: "" };
    } catch (error) {
      throw translateError(error, model);
    }
  }
}

/**
 * The request parameters a given model will actually accept.
 *
 * Adaptive thinking, `output_config.effort` and server-side fallbacks are all
 * newer than the small models, and Haiku 4.5 rejects every one of them with a
 * 400 rather than ignoring them. Since translation moved to Haiku, sending an
 * Opus-shaped request would fail every message in the product.
 *
 * `format` is passed through regardless: structured output is supported
 * everywhere, and it is the thing that stops a translation arriving as prose.
 */
function reasoning(
  model: string,
  effort: "low" | "medium" | "high",
  outputConfig?: Record<string, unknown>,
  options: { fallbacks?: boolean } = {},
) {
  const caps = modelCapabilities(model);
  const config = {
    ...(caps.effort ? { effort } : {}),
    ...(outputConfig ?? {}),
  };

  return {
    ...(caps.adaptiveThinking ? { thinking: { type: "adaptive" as const } } : {}),
    ...(Object.keys(config).length > 0 ? { output_config: config } : {}),
    ...(caps.serverSideFallback && options.fallbacks !== false
      ? { betas: [FALLBACK_BETA], fallbacks: "default" as const }
      : {}),
  };
}

/**
 * Marks the system prompt as a cache breakpoint.
 *
 * Nexus system prompts are large and near-identical across calls — the
 * doctrine profile alone is a few hundred tokens repeated on every request —
 * so the judge and the sidebar read their prefix at a tenth of input price.
 *
 * Translation no longer benefits, and it is worth knowing why rather than
 * wondering later: the minimum cacheable prefix is model-dependent, and on
 * Haiku 4.5 it is 4096 tokens. The translation system prompt is around 2000,
 * so it silently does not cache — no error, just `cache_creation_input_tokens`
 * permanently zero. It is marked anyway, because the marker costs nothing and
 * an operator who routes translation back to a larger model gets caching back
 * without touching this file. Haiku is still four times cheaper per call with
 * no cache than Opus was with one.
 */
function cacheableSystem(system: string): Anthropic.Beta.BetaTextBlockParam[] {
  return [{ type: "text", text: system, cache_control: { type: "ephemeral" } }];
}

function textOf(content: readonly Anthropic.Beta.BetaContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

function usageOf(usage: Anthropic.Beta.BetaUsage): TokenUsage {
  return {
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
    cachedInputTokens: usage.cache_read_input_tokens ?? 0,
  };
}

/** Maps SDK errors onto domain errors, most specific first. */
function translateError(error: unknown, model: string): NexusError {
  if (error instanceof NexusError) return error;

  if (error instanceof Anthropic.RateLimitError) {
    return new NexusError(
      "rate_limited",
      "LLM provider rate limit reached",
      { model },
      { cause: error },
    );
  }
  if (error instanceof Anthropic.AuthenticationError) {
    return new NexusError(
      "provider_unavailable",
      "LLM provider rejected the API key",
      { model },
      { cause: error },
    );
  }
  if (error instanceof Anthropic.BadRequestError) {
    return new NexusError(
      "validation_failed",
      `LLM provider rejected the request: ${error.message}`,
      { model },
      { cause: error },
    );
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new NexusError(
      "provider_unavailable",
      "Could not reach the LLM provider",
      { model },
      { cause: error },
    );
  }
  if (error instanceof Anthropic.APIError) {
    return new NexusError(
      "provider_unavailable",
      `LLM provider error ${error.status ?? "unknown"}: ${error.message}`,
      { model },
      { cause: error },
    );
  }
  return new NexusError(
    "provider_unavailable",
    error instanceof Error ? error.message : "Unknown LLM provider failure",
    { model },
    { cause: error },
  );
}

import type { LlmEffort, LlmModelRouter, LlmTask } from "@nexus/core";

/**
 * Which model serves which job.
 *
 * Every task defaults to the most capable model. Downgrading for cost is an
 * operator's decision, not a default baked into the code — so each task can
 * be overridden with an environment variable, and the override is visible in
 * one place rather than scattered through feature code.
 */
export const DEFAULT_MODEL = "claude-opus-5";

const ENV_KEYS: Record<LlmTask, string> = {
  translation: "NEXUS_MODEL_TRANSLATION",
  language_detection: "NEXUS_MODEL_LANGUAGE_DETECTION",
  enablement: "NEXUS_MODEL_ENABLEMENT",
  moderation: "NEXUS_MODEL_MODERATION",
  knowledge_synthesis: "NEXUS_MODEL_KNOWLEDGE",
  practice: "NEXUS_MODEL_PRACTICE",
  practice_debrief: "NEXUS_MODEL_PRACTICE_DEBRIEF",
};

/**
 * Per-task effort and output budgets.
 *
 * Translation runs at low effort because it is a mechanical transformation in
 * the latency path of a live conversation — a seeker watching a "translating"
 * spinner is a worse outcome than a marginally better word choice. Moderation
 * and enablement run high: they are off the critical path and being wrong
 * there costs more.
 */
export const TASK_DEFAULTS: Record<
  LlmTask,
  { readonly effort: LlmEffort; readonly maxTokens: number }
> = {
  translation: { effort: "low", maxTokens: 4000 },
  language_detection: { effort: "low", maxTokens: 256 },
  enablement: { effort: "high", maxTokens: 8000 },
  moderation: { effort: "high", maxTokens: 4000 },
  knowledge_synthesis: { effort: "medium", maxTokens: 8000 },
  // In the latency path of a live exercise, and short: one message from a
  // person who is upset, not an essay.
  practice: { effort: "medium", maxTokens: 1500 },
  // Off the critical path, read once, and acted on for years. Worth thinking
  // about properly.
  practice_debrief: { effort: "high", maxTokens: 8000 },
};

export class StaticModelRouter implements LlmModelRouter {
  readonly #models: Record<LlmTask, string>;

  constructor(overrides: Partial<Record<LlmTask, string>> = {}) {
    this.#models = {
      translation: overrides.translation ?? DEFAULT_MODEL,
      language_detection: overrides.language_detection ?? DEFAULT_MODEL,
      enablement: overrides.enablement ?? DEFAULT_MODEL,
      moderation: overrides.moderation ?? DEFAULT_MODEL,
      knowledge_synthesis: overrides.knowledge_synthesis ?? DEFAULT_MODEL,
      practice: overrides.practice ?? DEFAULT_MODEL,
      practice_debrief: overrides.practice_debrief ?? DEFAULT_MODEL,
    };
  }

  static fromEnv(
    env: Record<string, string | undefined> = process.env,
  ): StaticModelRouter {
    const overrides: Partial<Record<LlmTask, string>> = {};
    for (const [task, key] of Object.entries(ENV_KEYS) as [LlmTask, string][]) {
      const value = env[key];
      if (value) overrides[task] = value;
    }
    return new StaticModelRouter(overrides);
  }

  modelFor(task: LlmTask): string {
    return this.#models[task];
  }
}

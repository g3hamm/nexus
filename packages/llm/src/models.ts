import type { LlmEffort, LlmModelRouter, LlmTask } from "@nexus/core";

/**
 * Which model serves which job.
 *
 * Judgement runs on the most capable model. Translation does not, and that is
 * a decision an operator made after seeing the numbers rather than a shortcut:
 * translating one message is a mechanical transformation, the Christian
 * glossary already carries the part that needs care, and a reasoning model
 * reasoning about it cost roughly four times as much and several seconds of
 * latency in the middle of a live conversation.
 *
 * Everything else stays on Opus, with one deliberate second exception:
 * `enablement_verses` — a handful of scripture suggestions, regenerated
 * automatically after every seeker message rather than on request. Judging
 * *what a volunteer should understand* about someone stays on the careful
 * model; suggesting *which verses might fit* is closer to translation's
 * mechanical end of the spectrum, and running it on Opus at the cadence this
 * feature needs would turn "every message" into a cost nobody chose.
 *
 * Every task is still overridable by environment variable, in one place rather
 * than scattered through feature code.
 */
export const DEFAULT_MODEL = "claude-opus-5";

/** Fast, cheap, and entirely adequate for a mechanical transformation. */
export const TRANSLATION_MODEL = "claude-haiku-4-5";

const TASK_MODELS: Record<LlmTask, string> = {
  translation: TRANSLATION_MODEL,
  language_detection: TRANSLATION_MODEL,
  enablement: DEFAULT_MODEL,
  // Cheap and frequent on purpose — see the doc comment on the task itself.
  enablement_verses: TRANSLATION_MODEL,
  moderation: DEFAULT_MODEL,
  knowledge_synthesis: DEFAULT_MODEL,
  practice: DEFAULT_MODEL,
  practice_debrief: DEFAULT_MODEL,
};

/**
 * What a model will accept in a request.
 *
 * Adaptive thinking, `output_config.effort` and server-side fallbacks are all
 * newer than Haiku 4.5, and it rejects them outright — sending an Opus-shaped
 * request to a small model is a 400, not a graceful degradation. Matching is a
 * deliberate allowlist rather than a denylist: an unrecognised model gets the
 * plain request that every model accepts, so a future override cannot break
 * translation by being newer than this file.
 */
const REASONING_MODELS = [
  /^claude-fable-/,
  /^claude-mythos-/,
  /^claude-opus-5/,
  /^claude-opus-4-[678]/,
  /^claude-sonnet-5/,
  /^claude-sonnet-4-6/,
];

/** Where the `fallbacks: "default"` form is documented to work. */
const FALLBACK_MODELS = [/^claude-fable-/, /^claude-mythos-/, /^claude-opus-5/];

export interface ModelCapabilities {
  readonly adaptiveThinking: boolean;
  readonly effort: boolean;
  readonly serverSideFallback: boolean;
}

export function modelCapabilities(model: string): ModelCapabilities {
  const reasoning = REASONING_MODELS.some((p) => p.test(model));
  return {
    adaptiveThinking: reasoning,
    effort: reasoning,
    serverSideFallback: FALLBACK_MODELS.some((p) => p.test(model)),
  };
}

const ENV_KEYS: Record<LlmTask, string> = {
  translation: "NEXUS_MODEL_TRANSLATION",
  language_detection: "NEXUS_MODEL_LANGUAGE_DETECTION",
  enablement: "NEXUS_MODEL_ENABLEMENT",
  enablement_verses: "NEXUS_MODEL_ENABLEMENT_VERSES",
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
  // Effort is not sent to a model that has none. Kept accurate so that an
  // operator who routes translation back to Opus gets the cheap setting.
  translation: { effort: "low", maxTokens: 4000 },
  language_detection: { effort: "low", maxTokens: 256 },
  enablement: { effort: "high", maxTokens: 8000 },
  // A handful of verses and a one-line reason each — not the full analysis.
  enablement_verses: { effort: "low", maxTokens: 1200 },
  moderation: { effort: "high", maxTokens: 4000 },
  knowledge_synthesis: { effort: "medium", maxTokens: 8000 },
  // In the latency path of a live exercise, and short: one message from a
  // person who is upset, not an essay.
  practice: { effort: "medium", maxTokens: 1500 },
  // Off the critical path, read once, and acted on for years. Worth thinking
  // about properly.
  practice_debrief: { effort: "high", maxTokens: 8000 },
};

/** An explicit `undefined` in an override object must not erase a default. */
function stripUndefined(
  overrides: Partial<Record<LlmTask, string>>,
): Partial<Record<LlmTask, string>> {
  return Object.fromEntries(
    Object.entries(overrides).filter(([, value]) => value !== undefined),
  ) as Partial<Record<LlmTask, string>>;
}

export class StaticModelRouter implements LlmModelRouter {
  readonly #models: Record<LlmTask, string>;

  constructor(overrides: Partial<Record<LlmTask, string>> = {}) {
    this.#models = { ...TASK_MODELS, ...stripUndefined(overrides) };
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

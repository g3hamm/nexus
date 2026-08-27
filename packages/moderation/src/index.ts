/**
 * @nexus/moderation — the judge.
 *
 * Watches both parties, produces structured verdicts, and advises rather than
 * acts for everything short of a crisis. See ADR 4 for the doctrinal frame and
 * `prompts.ts` for why the instructions are shaped the way they are.
 */
export { LlmJudge, type LlmJudgeOptions } from "./judge.js";
export { CadenceModerationScheduler, type CadenceOptions } from "./scheduler.js";
export { buildJudgePrompt, formatWindow } from "./prompts.js";

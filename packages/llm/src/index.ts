/**
 * @nexus/llm — the swappable LLM layer.
 *
 * Feature code imports `LlmProvider` from @nexus/core and receives an
 * implementation from `createLlmProvider`. It never imports a vendor SDK,
 * which is what makes the provider genuinely interchangeable rather than
 * nominally so.
 */
export { AnthropicProvider, type AnthropicProviderOptions } from "./anthropic.js";
export { FakeLlmProvider, type ScriptedResponse } from "./fake.js";
export { StaticModelRouter, DEFAULT_MODEL, TASK_DEFAULTS } from "./models.js";
export { createLlmProvider, type LlmConfig } from "./factory.js";

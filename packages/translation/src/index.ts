/**
 * @nexus/translation — translation that keeps Christian vocabulary intact.
 *
 * See `glossary.ts` for why this package exists at all: general-purpose
 * translation is perfectly good at turning "grace" into "elegance" and
 * "born again" into "reincarnated", and either one derails a conversation
 * that a person may have taken a real risk to start.
 */
export { CHRISTIAN_GLOSSARY, CHRISTIAN_GLOSSARY_ENTRIES } from "./glossary.js";
export { LlmTranslator, type LlmTranslatorOptions } from "./llm-translator.js";
export { buildTranslationSystemPrompt, LANGUAGE_DETECTION_PROMPT } from "./prompts.js";

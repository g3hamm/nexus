/**
 * @nexus/enablement — the volunteer sidebar.
 *
 * Retrieves from the knowledge base, then suggests. It offers material and
 * never words to paste: the seeker came to talk to a person, and a sidebar
 * that could write for the volunteer turns this into a chatbot wearing one.
 */
export { LlmEnablementEngine, type LlmEnablementOptions } from "./engine.js";
export { buildEnablementPrompt, formatConversation, formatSources } from "./prompts.js";

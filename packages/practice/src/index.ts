/**
 * @nexus/practice — the volunteer training sandbox.
 *
 * Practice runs on the real conversation surface: the same translation, the
 * same enablement sidebar, the same scripture lookups. Rehearsing on a mock
 * teaches the mock. What is not real is the consequence — practice
 * conversations never enter the seeker queue, are never reviewed by the
 * judge, and never page a human being.
 */
export { LlmPracticePartner, MESSAGES_FOR_TESTS } from "./partner.js";
export { PRACTICE_SCENARIOS, findScenario, scenarioIds } from "./scenarios.js";
export { buildDebriefPrompt, buildPartnerPrompt, formatExchanges } from "./prompts.js";

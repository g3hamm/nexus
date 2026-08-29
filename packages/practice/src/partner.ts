import type {
  AcademyModuleBrief,
  LanguageCode,
  LlmMessage,
  LlmProvider,
  PracticeDebrief,
  PracticeExchange,
  PracticePartner,
  PracticeScenario,
  PracticeTurn,
} from "@nexus/core";
import { practiceDebriefSchema, practiceTurnSchema } from "@nexus/core";
import { buildDebriefPrompt, buildPartnerPrompt, formatExchanges } from "./prompts.js";

/**
 * The simulated seeker, and the coach afterwards.
 *
 * Both go through `completeStructured`, so a partner that decides to write a
 * preamble or a debrief that invents a field is caught and re-asked rather
 * than reaching a volunteer as a broken screen.
 *
 * The persona is the system prompt and the conversation is the messages, so
 * the expensive constant part of every turn sits in the model's cache prefix
 * — which matters, because a practice session is a dozen calls with the same
 * two thousand tokens of character notes at the front of each one.
 */
export class LlmPracticePartner implements PracticePartner {
  readonly #llm: LlmProvider;

  constructor(llm: LlmProvider) {
    this.#llm = llm;
  }

  async reply(
    scenario: PracticeScenario,
    exchanges: readonly PracticeExchange[],
  ): Promise<PracticeTurn> {
    const result = await this.#llm.completeStructured({
      task: "practice",
      system: buildPartnerPrompt(scenario),
      messages: toMessages(exchanges),
      schema: practiceTurnSchema,
      schemaName: "PracticeTurn",
    });

    return result.value;
  }

  async debrief(
    scenario: PracticeScenario,
    exchanges: readonly PracticeExchange[],
    language: LanguageCode,
    module?: AcademyModuleBrief,
  ): Promise<PracticeDebrief> {
    const result = await this.#llm.completeStructured({
      task: "practice_debrief",
      system: buildDebriefPrompt(scenario, language, module),
      messages: [{ role: "user", content: formatExchanges(exchanges) }],
      schema: practiceDebriefSchema,
      schemaName: "PracticeDebrief",
    });

    return result.value;
  }
}

/**
 * The transcript, cast into model turns.
 *
 * The simulated seeker is the assistant and the volunteer is the user, which
 * is the way round that keeps the model in character: it is continuing its
 * own side of a conversation rather than being asked to describe what someone
 * else would say. The difference in practice is large — the second framing
 * drifts into narration and politeness within a few turns.
 *
 * A conversation that opens with the seeker leaves no user turn to start
 * from, so the opening is requested with a neutral cue rather than an empty
 * messages array, which providers reject.
 */
function toMessages(exchanges: readonly PracticeExchange[]): readonly LlmMessage[] {
  if (exchanges.length === 0) {
    return [{ role: "user", content: "(the volunteer has not written yet)" }];
  }

  const messages: LlmMessage[] = exchanges.map((e) => ({
    role: e.role === "seeker" ? ("assistant" as const) : ("user" as const),
    content: e.text,
  }));

  // Providers require the conversation to end on a user turn before they will
  // produce an assistant one. If the last word was the seeker's, the partner
  // is following itself up — which people do, when nobody answers.
  if (messages[messages.length - 1]?.role === "assistant") {
    messages.push({ role: "user", content: "(no reply yet)" });
  }

  return messages;
}

export const MESSAGES_FOR_TESTS = toMessages;

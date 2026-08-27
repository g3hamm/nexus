/**
 * @nexus/enablement — the volunteer sidebar.
 *
 * SCAFFOLD. The contracts are settled; the flows are wave two.
 *
 * Everything this needs already exists: `LlmProvider.completeStructured` gives
 * schema-validated output with retries, `KnowledgeBase.search` gives cited
 * sources, and `BibleProvider.lookup` gives passage previews.
 *
 * Three rules that are design decisions, not implementation details:
 *
 *   1. It offers; it never speaks. Nothing here may post to a conversation.
 *      The seeker came to talk to a person, and a sidebar that could act on
 *      the volunteer's behalf turns Nexus into a chatbot wearing a volunteer
 *      as a costume.
 *   2. Every substantive claim traces to a retrieved source. Populate
 *      `EnablementSuggestions.sources` and show it, so a volunteer can judge
 *      whether to trust a suggestion before putting it in front of someone.
 *   3. `SeekerUnderstanding` is a working hypothesis, not a dossier. Keep the
 *      confidence honest and let the UI hedge it — being confidently wrong
 *      about why someone is here is worse than saying nothing.
 *
 * Run this off the critical path. A volunteer waiting on the sidebar is a
 * seeker watching a silent screen.
 */
import type {
  ConversationWindow,
  EnablementEngine,
  EnablementSuggestions,
} from "@nexus/core";
import { NexusError } from "@nexus/core";

export class LlmEnablementEngine implements EnablementEngine {
  readonly name = "llm";

  async suggest(
    _window: ConversationWindow,
    _signal?: AbortSignal,
  ): Promise<EnablementSuggestions> {
    throw NexusError.notImplemented("LlmEnablementEngine.suggest");
  }
}

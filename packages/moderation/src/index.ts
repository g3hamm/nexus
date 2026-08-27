/**
 * @nexus/moderation — the judge.
 *
 * SCAFFOLD. The contracts are settled; the flows are wave two.
 *
 * `ModerationVerdict` and its enums in @nexus/core already encode the hard
 * decisions. What is left is the prompt, the schedule, and the wiring.
 *
 * Things worth not rediscovering the hard way:
 *
 *   - It watches both parties. A volunteer who turns coercive, solicits money,
 *     or pushes to move the conversation to a private channel is the more
 *     serious case, because they carry the platform's authority.
 *   - It is advisory. Only `escalate_crisis` and `terminate` act without a
 *     human. An LLM should not be quietly ending conversations about faith
 *     because it misread an idiom in a language it handles poorly.
 *   - Low confidence biases toward review, never toward action.
 *   - `self_harm_risk` escalates and never punishes. Someone saying they want
 *     to die is the reason this platform exists, not a violation of it.
 *   - Run it on a cadence plus on start and end, not on every message.
 *     `ModerationScheduler` is where that policy lives.
 *
 * The judge reasons about self-harm, sexual content, and threats in order to
 * flag them, which is exactly the shape of request a safety classifier may
 * decline — this is why `AnthropicProvider` sends `fallbacks: "default"`.
 * A declined moderation call means an unwatched conversation.
 */
import type {
  ConversationWindow,
  Judge,
  ModerationScheduler,
  ModerationVerdict,
} from "@nexus/core";
import { NexusError } from "@nexus/core";

export class LlmJudge implements Judge {
  readonly name = "llm";

  async review(
    _window: ConversationWindow,
    _signal?: AbortSignal,
  ): Promise<ModerationVerdict> {
    throw NexusError.notImplemented("LlmJudge.review");
  }
}

export class CadenceModerationScheduler implements ModerationScheduler {
  shouldReview(_window: ConversationWindow, _lastReviewAt: Date | null): boolean {
    throw NexusError.notImplemented("CadenceModerationScheduler.shouldReview");
  }
}

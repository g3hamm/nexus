import type {
  ConversationWindow,
  DoctrineProfile,
  Judge,
  LlmProvider,
  MessageId,
  ModerationVerdict,
} from "@nexus/core";
import type { z } from "zod";
import {
  ECUMENICAL_PROFILE,
  asMessageId,
  moderationVerdictSchema,
  original,
  renderingFor,
} from "@nexus/core";
import { buildJudgePrompt, formatWindow } from "./prompts.js";

export interface LlmJudgeOptions {
  readonly doctrine?: DoctrineProfile;
  /** How many recent messages to show. Bounded so cost stays predictable. */
  readonly windowSize?: number;
}

export class LlmJudge implements Judge {
  readonly name = "llm";
  readonly #llm: LlmProvider;
  readonly #systemPrompt: string;
  readonly #windowSize: number;

  constructor(llm: LlmProvider, options: LlmJudgeOptions = {}) {
    this.#llm = llm;
    this.#systemPrompt = buildJudgePrompt(options.doctrine ?? ECUMENICAL_PROFILE);
    this.#windowSize = options.windowSize ?? 30;
  }

  async review(
    window: ConversationWindow,
    signal?: AbortSignal,
  ): Promise<ModerationVerdict> {
    const recent = window.messages.slice(-this.#windowSize);

    // An empty window has nothing to judge, and asking anyway invites the
    // model to invent a concern in order to look useful.
    if (recent.length === 0) return CLEAN;

    const rendered = formatWindow(
      recent.map((message) => {
        const source = original(message);
        const english = renderingFor(message, "en");
        return {
          id: message.id,
          role: message.authorRole,
          original: source.text,
          originalLanguage: source.language,
          english: english.text === source.text ? null : english.text,
        };
      }),
    );

    const result = await this.#llm.completeStructured({
      task: "moderation",
      system: this.#systemPrompt,
      messages: [
        {
          role: "user",
          content:
            `Review this conversation window and return one verdict.\n\n` +
            `<conversation>\n${rendered}\n</conversation>`,
        },
      ],
      schema: moderationVerdictSchema,
      schemaName: "ModerationVerdict",
      ...(signal ? { signal } : {}),
    });

    return sanitise(
      result.value,
      recent.map((m) => m.id),
    );
  }
}

const CLEAN: ModerationVerdict = {
  category: null,
  severity: "none",
  subject: "unclear",
  rationale: "No messages to review.",
  action: "none",
  evidenceMessageIds: [],
  confidence: 1,
};

/**
 * Corrects verdicts the model is allowed to get wrong, and re-brands the ids.
 *
 * Two rules from the prompt are load-bearing enough that they are enforced in
 * code rather than trusted to instruction-following, because the cost of the
 * model ignoring them once is a conversation ended wrongly, or someone in
 * crisis being treated as a rule-breaker.
 *
 * The schema yields plain strings for message ids, so this is also the point
 * where they become `MessageId`s — after being checked against the window,
 * never before.
 */
function sanitise(
  verdict: z.infer<typeof moderationVerdictSchema>,
  windowIds: readonly MessageId[],
): ModerationVerdict {
  let action = verdict.action;

  // Self-harm is a reason to get help to someone, never to punish them.
  if (verdict.category === "self_harm_risk" && action === "terminate") {
    action = "escalate_crisis";
  }

  // Acting without a human requires conviction. A hesitant model gets to
  // raise a flag, not to end a conversation.
  if (
    (action === "terminate" || action === "escalate_crisis") &&
    verdict.confidence < 0.7
  ) {
    action = "flag_for_review";
  }

  // Evidence must point at messages the judge was actually shown; a
  // hallucinated id makes a flag unreviewable.
  const valid = new Set<string>(windowIds);
  const evidence = verdict.evidenceMessageIds
    .filter((id) => valid.has(id))
    .map(asMessageId);

  return { ...verdict, action, evidenceMessageIds: evidence };
}

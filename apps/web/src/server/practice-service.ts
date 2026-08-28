import "server-only";

import type {
  Conversation,
  ConversationId,
  PracticeDebrief,
  PracticeExchange,
  PracticeScenario,
  Volunteer,
} from "@nexus/core";
import { NexusError, isPractice, original } from "@nexus/core";
import { findScenario } from "@nexus/practice";
import type { Container } from "./container";
import { ConversationService } from "./conversation-service";

/** A rehearsal is not something to keep for ninety days. */
const PRACTICE_RETENTION_DAYS = 14;

/** Enough to have a real conversation; short enough to bound the cost. */
const MAX_PRACTICE_MESSAGES = 60;

/**
 * The volunteer training sandbox.
 *
 * A practice session is a real conversation on the real surface. Same
 * translation, same enablement sidebar, same scripture hover, same crisis
 * card. That is the point: a volunteer who rehearsed on a purpose-built mock
 * has rehearsed the mock, and will meet the real product for the first time
 * with a real person on the other end.
 *
 * What is not real is the consequence. Practice conversations never enter the
 * seeker queue, are never reviewed by the judge, and never page anybody —
 * see `ModerationService.reviewIfDue`, which returns early. A volunteer
 * working through the self-harm scenario at two in the morning must not wake
 * a pastor.
 */
export class PracticeService {
  readonly #c: Container;

  constructor(container: Container) {
    this.#c = container;
  }

  /**
   * Opens a session and lets the other person speak first.
   *
   * Deliberately the seeker's opening move, as it is in life: a volunteer's
   * first job is to read something they did not choose and respond to it, not
   * to deliver a prepared opener into silence.
   */
  async start(volunteer: Volunteer, scenarioId: string): Promise<Conversation> {
    const scenario = requireScenario(scenarioId);
    const volunteerLanguage = volunteer.languages[0] ?? "en";

    const conversation = await this.#c.conversations.createPractice({
      volunteerId: volunteer.id,
      volunteerLanguage,
      seekerLanguage: scenario.language,
      scenario: scenario.id,
      retainUntil: new Date(Date.now() + PRACTICE_RETENTION_DAYS * 86_400_000),
    });

    await this.#c.realtime.createRoom({
      conversationId: conversation.id,
      modality: conversation.modality,
    });

    await this.#c.audit.record({
      action: "practice.started",
      actorRole: "volunteer",
      actorId: volunteer.id,
      conversationId: conversation.id,
      detail: { scenario: scenario.id, difficulty: scenario.difficulty },
    });

    await this.#speak(conversation.id, scenario, []);
    return conversation;
  }

  /**
   * The simulated seeker's answer to whatever the volunteer just said.
   *
   * Never throws into the caller. This runs after the volunteer's own message
   * is already delivered, and a partner that is slow or unavailable should
   * leave them looking at an unanswered message — which is a thing that
   * happens in real conversations — rather than at an error.
   */
  async respond(conversationId: ConversationId): Promise<void> {
    try {
      const conversation = await this.#c.conversations.findById(conversationId);
      if (!conversation || !isPractice(conversation)) return;
      if (conversation.status !== "active") return;

      const scenario = findScenario(conversation.practiceScenario ?? "");
      if (!scenario) return;

      const exchanges = await this.#exchanges(conversation);
      if (exchanges.length >= MAX_PRACTICE_MESSAGES) {
        await this.#c.conversations.end(conversationId, "ended");
        return;
      }

      await this.#speak(conversationId, scenario, exchanges);
    } catch (error) {
      console.error("[nexus] practice partner failed", { conversationId, error });
    }
  }

  /**
   * Ends the session and marks it.
   *
   * The debrief is generated on demand rather than stored: it is read once,
   * by one person, and keeping a file of assessments of volunteers is a
   * different and much more sensitive thing than running a training exercise.
   * If a ministry decides it wants that, it should be a deliberate decision
   * with the volunteer's knowledge, not a side effect of this.
   */
  async debrief(
    conversationId: ConversationId,
    volunteer: Volunteer,
  ): Promise<PracticeDebrief> {
    const conversation = await this.#c.conversations.findById(conversationId);
    if (!conversation || !isPractice(conversation)) {
      throw NexusError.notFound("Practice session", conversationId);
    }
    if (conversation.volunteerId !== volunteer.id) {
      throw NexusError.forbidden("This is not your practice session");
    }

    const scenario = requireScenario(conversation.practiceScenario ?? "");
    const exchanges = await this.#exchanges(conversation);

    if (!exchanges.some((e) => e.role === "volunteer")) {
      throw NexusError.validation(
        "There is nothing to review yet — say something first.",
      );
    }

    if (conversation.status === "active") {
      await this.#c.conversations.end(conversationId, "ended");
    }

    const debrief = await this.#c.practice.debrief(
      scenario,
      exchanges,
      volunteer.languages[0] ?? "en",
    );

    await this.#c.audit.record({
      action: "practice.debriefed",
      actorRole: "volunteer",
      actorId: volunteer.id,
      conversationId,
      // The readiness band, not the notes. What a coach said about somebody's
      // fumbling first attempt does not belong in a permanent audit trail.
      detail: { scenario: scenario.id, readiness: debrief.readiness },
    });

    return debrief;
  }

  /** One turn from the simulated seeker, through the normal send path. */
  async #speak(
    conversationId: ConversationId,
    scenario: PracticeScenario,
    exchanges: readonly PracticeExchange[],
  ): Promise<void> {
    const turn = await this.#c.practice.reply(scenario, exchanges);

    await new ConversationService(this.#c).send({
      conversationId,
      authorRole: "seeker",
      authorId: null,
      text: turn.text,
      language: scenario.language,
    });

    // Straight from the partner's own signal, with no judge involved. It is
    // how a volunteer gets to see the crisis card appear for real, in the
    // scenario built to produce it, without a flag being raised or anybody
    // being paged.
    if (turn.disclosesRisk) {
      await this.#c.conversations.markCrisis(conversationId, new Date());
      await this.#notifyRisk(conversationId);
    }

    if (turn.ends) {
      await this.#c.conversations.end(conversationId, "ended");
    }
  }

  /**
   * The same notice a volunteer would get in a real conversation.
   *
   * ModerationService normally publishes this, and it skips practice
   * entirely — so without this line the one scenario built to teach a
   * volunteer what a crisis looks like would be the one place the crisis
   * banner never appeared. The wording says plainly that it is an exercise:
   * training someone to be reassured by "an administrator has been alerted"
   * when nobody was would be its own kind of harm.
   */
  async #notifyRisk(conversationId: ConversationId): Promise<void> {
    try {
      const conversation = await this.#c.conversations.findById(conversationId);
      if (!conversation) return;

      await this.#c.realtime.publishEvent(conversation.roomId, {
        type: "moderation_notice",
        severity: "critical",
        text:
          "Someone here may be at risk. In a real conversation this is where you stop " +
          "explaining and start asking — directly, and without being frightened of the " +
          "answer. This is practice, so nobody has been alerted.",
      });
    } catch {
      // The card is already on screen from the durable flag. This is extra.
    }
  }

  /**
   * The transcript in the words each side actually wrote.
   *
   * Originals, never translations. Marking the volunteer on the translator's
   * rendering of their message would be marking the wrong thing, and the
   * partner needs to see its own previous turns in its own language to stay
   * in character.
   */
  async #exchanges(conversation: Conversation): Promise<readonly PracticeExchange[]> {
    const messages = await this.#c.messages.listForConversation(conversation.id, {
      limit: MAX_PRACTICE_MESSAGES,
    });

    return messages
      .filter((m) => m.authorRole === "seeker" || m.authorRole === "volunteer")
      .map((m) => ({
        role: m.authorRole === "seeker" ? ("seeker" as const) : ("volunteer" as const),
        text: original(m).text,
      }));
  }
}

function requireScenario(id: string): PracticeScenario {
  const scenario = findScenario(id);
  if (!scenario) throw NexusError.notFound("Practice scenario", id);
  return scenario;
}

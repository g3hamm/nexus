import "server-only";

import type {
  Conversation,
  ConversationId,
  LanguageCode,
  Message,
  ParticipantRole,
  Rendering,
  SeekerId,
  Volunteer,
} from "@nexus/core";
import {
  NexusError,
  asRoomId,
  capabilitiesFor,
  renderingFor,
  sameLanguage,
} from "@nexus/core";
import type { Container } from "./container";

export interface StartConversationResult {
  readonly conversation: Conversation;
}

export interface SendMessageResult {
  readonly message: Message;
  /** True when the message went out without its translation. */
  readonly translationDegraded: boolean;
}

/**
 * The application logic for a conversation.
 *
 * Route handlers stay thin and this stays testable — it depends only on the
 * container's ports, so the whole flow can be exercised against fakes.
 */
export class ConversationService {
  readonly #c: Container;

  constructor(container: Container) {
    this.#c = container;
  }

  /**
   * A seeker arrives and a conversation exists immediately.
   *
   * No form, no account, no language picker. They are in the queue before
   * they have been asked a single question, which is the entire "no
   * instructions needed" requirement.
   */
  async startForSeeker(
    seekerId: SeekerId,
    language: LanguageCode,
    seekerName?: string,
  ): Promise<StartConversationResult> {
    const conversation = await this.#c.conversations.create({
      seekerId,
      seekerLanguage: language,
      modality: "text",
      ...(seekerName ? { seekerName } : {}),
      // Ninety days by default. A flag clears this, so anything under review
      // outlives the retention window.
      retainUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    });

    await this.#c.realtime.createRoom({
      conversationId: conversation.id,
      modality: conversation.modality,
    });

    await this.#c.audit.record({
      action: "conversation.started",
      actorRole: "seeker",
      actorId: null,
      conversationId: conversation.id,
      // Whether they gave a name, never the name itself. The audit log is the
      // one table not encrypted per conversation, and it outlives the
      // transcript it describes.
      detail: { language, named: conversation.seekerName !== null },
    });

    return { conversation };
  }

  /**
   * A volunteer takes a waiting conversation.
   *
   * Returns null when someone else claimed it first — the caller offers the
   * next one rather than showing an error, because losing a race is normal
   * and not the volunteer's problem.
   */
  async claimForVolunteer(
    conversationId: ConversationId,
    volunteer: Volunteer,
  ): Promise<Conversation | null> {
    const language = volunteer.languages[0] ?? "en";
    const claimed = await this.#c.conversations.claim(
      conversationId,
      volunteer.id,
      language,
    );
    if (!claimed) return null;

    await this.#c.audit.record({
      action: "conversation.matched",
      actorRole: "volunteer",
      actorId: volunteer.id,
      conversationId: claimed.id,
      detail: { volunteerLanguage: language, seekerLanguage: claimed.seekerLanguage },
    });

    // Anything the seeker said while waiting needs translating now that we
    // know who is reading it.
    if (claimed.translationRequired) {
      await this.#backfillTranslations(claimed, language);
    }

    await this.#c.realtime.publishEvent(claimed.roomId, {
      type: "presence",
      role: "volunteer",
      joined: true,
    });

    return claimed;
  }

  /**
   * Send a message, translated for whoever will read it.
   *
   * The order matters: persist first, then notify. A realtime event that
   * arrives before the message is durable produces a client that fetches and
   * finds nothing.
   */
  async send(input: {
    readonly conversationId: ConversationId;
    readonly authorRole: ParticipantRole;
    readonly authorId: string | null;
    readonly text: string;
    readonly language: LanguageCode;
  }): Promise<SendMessageResult> {
    const conversation = await this.#c.conversations.findById(input.conversationId);
    if (!conversation) throw NexusError.notFound("Conversation", input.conversationId);
    if (conversation.status === "ended" || conversation.status === "terminated") {
      throw NexusError.conflict("This conversation has ended");
    }

    const renderings: Rendering[] = [
      { language: input.language, text: input.text, source: "original" },
    ];

    let translationDegraded = false;
    const targets = this.#targetLanguages(conversation, input.language);

    if (targets.length > 0) {
      const context = await this.#recentContext(conversation, input.language);

      for (const target of targets) {
        try {
          const translated = await this.#c.translator.translate({
            text: input.text,
            from: input.language,
            to: target,
            context,
          });
          renderings.push({
            language: target,
            text: translated.text,
            source: "machine",
            engine: translated.engine,
            confidence: translated.confidence,
          });
        } catch {
          // A translation failure must never swallow the message. Deliver the
          // original and let the UI say the translation is unavailable —
          // silence is far worse than an untranslated line.
          translationDegraded = true;
        }
      }
    }

    const message = await this.#c.messages.append({
      conversationId: conversation.id,
      authorRole: input.authorRole,
      authorId: input.authorId,
      originalLanguage: input.language,
      renderings,
    });

    try {
      await this.#c.realtime.publishEvent(conversation.roomId, {
        type: "message",
        messageId: message.id,
        sentAt: message.sentAt.toISOString(),
      });
    } catch {
      // The message is already durable. Clients reconcile on reconnect, so a
      // dropped notification must not fail the send.
    }

    return { message, translationDegraded };
  }

  /** Transcript rendered for one reader, in their language. */
  async transcriptFor(
    conversationId: ConversationId,
    readerLanguage: LanguageCode,
    options: { readonly after?: Date } = {},
  ): Promise<readonly TranscriptEntry[]> {
    const messages = await this.#c.messages.listForConversation(
      conversationId,
      options.after ? { after: options.after } : {},
    );

    return messages.map((message) => {
      const shown = renderingFor(message, readerLanguage);
      const original = message.renderings.find((r) => r.source === "original");
      return {
        id: message.id,
        authorRole: message.authorRole,
        text: shown.text,
        language: shown.language,
        // Always carry the original so a reader can check what was actually
        // said. Volunteers use this constantly on a tense turn.
        originalText: original?.text ?? shown.text,
        originalLanguage: original?.language ?? shown.language,
        wasTranslated: shown.source === "machine",
        // True when we could not translate — the UI says so rather than
        // silently showing text the reader cannot read.
        translationUnavailable:
          shown.source === "original" && !sameLanguage(shown.language, readerLanguage),
        sentAt: message.sentAt.toISOString(),
      };
    });
  }

  /** A realtime credential scoped to one participant in one conversation. */
  async accessTokenFor(
    conversation: Conversation,
    participantId: string,
    role: ParticipantRole,
    displayName: string,
  ) {
    return this.#c.realtime.issueAccessToken({
      roomId: asRoomId(conversation.roomId),
      participantId,
      role,
      displayName,
      // Text conversations get data only. Flipping this to "video" later is
      // the entire client-side change needed for calls.
      capabilities: capabilitiesFor(conversation.modality),
      ttlSeconds: 60 * 60,
    });
  }

  /** Languages that need a translation of a message written in `from`. */
  #targetLanguages(
    conversation: Conversation,
    from: LanguageCode,
  ): readonly LanguageCode[] {
    if (!conversation.translationRequired) return [];

    const participants = [
      conversation.seekerLanguage,
      conversation.volunteerLanguage,
    ].filter((l): l is LanguageCode => Boolean(l));

    return [...new Set(participants)].filter((l) => !sameLanguage(l, from));
  }

  /** Recent turns in the author's language, so pronouns resolve on translation. */
  async #recentContext(
    conversation: Conversation,
    language: LanguageCode,
  ): Promise<readonly string[]> {
    const recent = await this.#c.messages.listForConversation(conversation.id, {
      limit: 6,
    });
    return recent.map((m) => renderingFor(m, language).text);
  }

  /** Translate what the seeker said before a volunteer was assigned. */
  async #backfillTranslations(
    conversation: Conversation,
    volunteerLanguage: LanguageCode,
  ): Promise<void> {
    const existing = await this.#c.messages.listForConversation(conversation.id, {
      limit: 50,
    });

    for (const message of existing) {
      const already = message.renderings.some((r) =>
        sameLanguage(r.language, volunteerLanguage),
      );
      if (already) continue;

      const original = message.renderings.find((r) => r.source === "original");
      if (!original) continue;

      try {
        const translated = await this.#c.translator.translate({
          text: original.text,
          from: original.language,
          to: volunteerLanguage,
        });
        await this.#c.messages.addRendering(message.id, {
          language: volunteerLanguage,
          text: translated.text,
          source: "machine",
          engine: translated.engine,
          confidence: translated.confidence,
        });
      } catch {
        // Best effort — the volunteer still sees the original text, and the
        // read path marks it as untranslated rather than hiding it.
      }
    }
  }
}

export interface TranscriptEntry {
  readonly id: string;
  readonly authorRole: ParticipantRole;
  readonly text: string;
  readonly language: LanguageCode;
  readonly originalText: string;
  readonly originalLanguage: LanguageCode;
  readonly wasTranslated: boolean;
  readonly translationUnavailable: boolean;
  readonly sentAt: string;
}

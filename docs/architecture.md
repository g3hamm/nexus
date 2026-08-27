# Architecture

## The shape

Nexus is a ports-and-adapters monorepo. `@nexus/core` holds the domain model
and every interface; each capability gets its own package implementing one of
those interfaces; and one composition root wires them together.

```
                    ┌─────────────────────────────┐
                    │        @nexus/core          │
                    │  domain types + ALL ports   │
                    │   (depends on zod alone)    │
                    └──────────────┬──────────────┘
                                   │ implemented by
      ┌────────────┬───────────┬───┴────┬───────────┬────────────┐
      │            │           │        │           │            │
  @nexus/db   @nexus/crypto @nexus/llm  │  @nexus/realtime  @nexus/auth
      │            │           │        │           │            │
      │            │      @nexus/translation        │            │
      │            │           │        │           │            │
      └────────────┴───────────┴────┬───┴───────────┴────────────┘
                                    │ wired by
                    ┌───────────────┴─────────────────┐
                    │ apps/web/src/server/container.ts │
                    │   the ONLY file that knows        │
                    │   which implementation is used    │
                    └──────────────────────────────────┘
```

Swapping a provider is an edit in `container.ts` and nowhere else. That is the
whole reason for the indirection: this codebase is going to a larger team who
will want to change these decisions without a rewrite.

## How a message flows

A seeker writing Farsi to a volunteer reading English:

1. **`POST /api/conversations/[id]/messages`** — the route resolves who is
   asking from their session cookie and confirms they are part of _this_
   conversation. A volunteer's session grants no access to conversations they
   were not matched with.
2. **`ConversationService.send`** builds the renderings list, beginning with
   the author's own words, verbatim.
3. **Translation** — `LlmTranslator` is handed the text, the target language,
   and the last few turns for context. If both parties share a language this
   is skipped entirely and never reaches a model.
4. **Persistence** — `DrizzleMessageRepository.append` serialises every
   rendering to JSON, encrypts it with the conversation's data key, and writes
   ciphertext. There is no column in the schema that could hold readable
   message text.
5. **Notification** — a small event goes out on the LiveKit data channel
   saying a message landed. Deliberately after the write, never before.
6. **The clients refetch.** The realtime event is only a nudge; the transcript
   always comes from the server, so a forged data packet cannot inject a
   message into anyone's view.

### Failure behaviour

| What fails          | What happens                                                                                                                                   |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Translation         | The message is delivered untranslated and the reader is told the translation is unavailable. Losing a translation must never lose the message. |
| Realtime publish    | Swallowed. The message is already durable and clients reconcile via the background poll.                                                       |
| Realtime connection | The poll speeds up from 15s to 3s. Seekers on hostile networks degrade to "slightly delayed", not "stopped".                                   |
| KMS unwrap          | Hard failure. There is no path that returns a transcript without decrypting it properly.                                                       |

## Encryption

```
   AWS KMS master key  (never leaves the KMS)
            │ wraps
            ▼
   per-conversation data key  ──stored wrapped, beside the ciphertext──┐
            │ encrypts                                                 │
            ▼                                                          │
   message renderings (AES-256-GCM, conversation id bound in as AAD)  ─┘
```

Binding the conversation id into the ciphertext as additional authenticated
data means a message row copied from one conversation into another fails to
decrypt rather than decrypting into the wrong place.

Unwrapped data keys are cached in memory for five minutes, bounded to 256
entries. Without that, rendering a 200-message transcript costs 200 KMS calls.

See [ADR 0003](adr/0003-application-layer-encryption.md) for what this protects
against and — just as important — what it does not.

## Matching

Language is a **preference, not a filter**. Because translation sits under
every message, a Farsi speaker can be helped by an English volunteer tonight
rather than waiting for a Farsi volunteer tomorrow. A strategy that treated
language as a hard requirement would leave most of the world queueing.

Claiming a conversation is a single conditional UPDATE:

```sql
UPDATE conversations SET volunteer_id = $1, status = 'active'
WHERE id = $2 AND status = 'waiting' AND volunteer_id IS NULL
```

Two volunteers hitting Accept simultaneously both run it, exactly one matches
a row, and the loser is offered the next conversation. No transaction, no
lock, no race — which is also why the Neon HTTP driver's lack of multi-statement
transactions costs us nothing.

## Getting to video

This was designed in from the start, and it is deliberately boring:

1. `Conversation.modality` already exists and is persisted.
2. `capabilitiesFor(modality)` already maps a modality to publish permissions.
3. `LiveKitTransport.issueAccessToken` already translates those into LiveKit
   grants including `canPublishSources`.
4. The room, the participants, the matching, the moderation, and the audit
   trail are all unchanged.

What is actually left: a client that renders tracks, and a UI for starting a
call. No new service, no second matching path, no migration.

## What is not built yet

`packages/bible`, `packages/knowledge`, `packages/enablement`, and
`packages/moderation` contain settled contracts and no implementations. Each
one's `index.ts` documents the decisions already made so whoever picks it up
is not re-deciding them. They are constructed in `container.ts` already, so
the wiring point is visible.

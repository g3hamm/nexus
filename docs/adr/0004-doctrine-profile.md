# 4. An ecumenical, creedal doctrine profile — as configuration

Status: **Accepted** — 2026-08-27

## Context

The enablement sidebar gives volunteers doctrinal guidance, and the knowledge
base stores apologetics material. "Christian" spans traditions that disagree
sincerely and substantially. An AI that quietly picks a side is making a
theological claim on behalf of every volunteer using it.

## Decision

Ship an ecumenical, creedal posture: stand on what the Apostles' and Nicene
Creeds hold in common, and on contested secondary questions present the range
of Christian views rather than ruling between them.

Express it as a `DoctrineProfile` **config object** in `@nexus/core`, not as
prose baked into prompt strings.

## Rationale

- It admits the widest range of volunteers without asking any of them to
  misrepresent their own tradition.
- It is the right posture for a seeker who is not yet asking about baptism
  modes — they are asking whether God hears them.
- Keeping it as data means an admin can **read exactly what the AI has been
  told to believe**, which is impossible if it is scattered across prompts.
- A ministry adopting Nexus with a narrower confession can supply their own
  profile without forking the code. `KnowledgeDocument.doctrineProfiles`
  already scopes retrieval accordingly.

## The guardrails matter as much as the affirmations

Several are safety controls rather than theological ones:

- Never pressure, rush, or manipulate a seeker toward a decision.
- Never promise material benefit — money, immigration help, employment — in
  connection with faith.
- Never speculate about a named individual's salvation.
- Treat doubt, anger, and hard questions as welcome, not as attacks to defeat.
- Defer to the volunteer's judgement; offer material, never put words in their
  mouth.
- When a seeker is in danger, care for the person before the conversation.

The corresponding moderation category is `spiritual_coercion`, and it applies
to volunteers, not seekers.

## Consequences

- `doctrineToPrompt()` renders the profile once, in one place, so every flow
  says the same thing — and because the rendering is deterministic it sits
  inside the cacheable system-prompt prefix.
- A deployment that changes profile changes both prompts and knowledge-base
  retrieval together.
- The profile is currently referenced by the translation prompt. Wave two wires
  it into the enablement and moderation prompts as well.

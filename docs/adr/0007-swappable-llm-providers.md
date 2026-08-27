# 7. One LLM port, sturdy flows, models chosen per task

Status: **Accepted** — 2026-08-27

## Context

Two requirements that pull against each other: LLMs must be easily
interchangeable, and the flows built on them must be sturdy and unwavering —
calling the knowledge base for Christian guidance, holding the Christian sense
of words like "faith" through translation.

Interchangeability usually means a thin lowest-common-denominator wrapper.
Sturdiness usually means leaning on provider-specific features. Both were
asked for.

## Decision

A single `LlmProvider` port in `@nexus/core` with three methods — `complete`,
`completeStructured`, and `stream` — and adapters behind it. `AnthropicProvider`
is the default; `FakeLlmProvider` runs the whole app with no key at all.

Three things make the flows sturdy rather than the port thin:

**1. Every non-conversational flow uses `completeStructured`.** It takes a Zod
schema, validates the result, and on failure feeds the validation error back and
re-asks, up to a limit. Parsing prose out of a model breaks the first time it
writes a preamble; validating and re-asking does not. This is tested directly.

**2. Tasks, not models.** Call sites ask for `"translation"` or `"moderation"`;
a `StaticModelRouter` maps tasks to models. Every task defaults to the most
capable model — downgrading for cost is an operator's decision, exposed as
`NEXUS_MODEL_*` environment variables, not a default baked into feature code.
Effort is tuned per task: translation runs low because it sits in the latency
path of a live conversation, moderation runs high because being wrong there
costs more.

**3. Refusal fallbacks are on by default.** The judge is asked to reason about
self-harm, sexual content, and threats _in order to flag them_ — precisely the
shape of request a safety classifier may decline. A declined moderation call
means an unwatched conversation, so requests carry server-side fallbacks.

## The translation prompt is a cache decision

The full Christian glossary goes into the system prompt on every call, unchanged
byte for byte. This looks wasteful and is the opposite:

- The system prompt is the prompt-cache prefix. A **constant** glossary caches
  once and costs almost nothing after. Narrowing it per message would change the
  prefix every time and never hit cache.
- Narrowing does not work anyway. Matching glossary terms against the source
  text only finds them when the source is English — useless when the seeker is
  writing Farsi.

Volatile content (the text, the recent turns) goes in the messages, after the
cache breakpoint. A test asserts the prompt is byte-identical across builds,
because a stray timestamp in there would silently cost real money.

## Consequences

- Adding a provider is one adapter plus one case in `createLlmProvider`. No
  feature code changes, because nothing above the port knows a provider exists.
- The port is deliberately narrower than any one provider's API. Features
  needing more should extend the port, not reach around it.
- `FakeLlmProvider` validates its fixtures against the real schema — a test
  that passes with a fixture production would reject is worse than no test.

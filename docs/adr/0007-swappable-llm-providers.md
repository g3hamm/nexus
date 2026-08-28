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

## Which model runs which task

Every task started on `claude-opus-5`, on the principle that downgrading for
cost is an operator's decision rather than a default baked into the code. That
decision has now been made, once, with numbers in front of it.

**Translation and language detection run on Haiku 4.5. Everything else stays on
Opus 5.** Translating one message is a mechanical transformation, the glossary
above already carries the part that needs care, and a reasoning model reasoning
about it cost roughly four times as much and several seconds of latency in the
middle of a live conversation. Deciding whether someone is at risk, and deciding
what to put in front of a volunteer talking to a grieving stranger, are not
places to save money.

Two consequences worth writing down, because both are invisible until they bite:

**Small models reject the reasoning parameters.** Adaptive thinking,
`output_config.effort` and server-side fallbacks are all newer than Haiku 4.5,
and it answers a request carrying them with a 400 rather than ignoring them. So
`modelCapabilities()` gates each one, as an allowlist — an unrecognised model
gets the plain request every model accepts, so an override that is newer than
that file cannot break translation. Getting this wrong would not have degraded
translation quality; it would have failed every message in the product.

**The translation prompt no longer caches.** The minimum cacheable prefix is
model-dependent and it is *not* monotonic across generations: 512 tokens on
Opus 5, but 4096 on Haiku 4.5. The translation system prompt is around 2000, so
it silently does not cache — no error, just `cache_creation_input_tokens`
permanently zero. The section above is still right about why the glossary is
constant; it just buys nothing at this model size. The move is still worth it
by a wide margin: Haiku with no cache is about a quarter the cost per call of
Opus with one. The breakpoint stays marked, because it costs nothing and an
operator routing translation back to a larger model gets caching back for free.

## Consequences

- Adding a provider is one adapter plus one case in `createLlmProvider`. No
  feature code changes, because nothing above the port knows a provider exists.
- The port is deliberately narrower than any one provider's API. Features
  needing more should extend the port, not reach around it.
- `FakeLlmProvider` validates its fixtures against the real schema — a test
  that passes with a fixture production would reject is worse than no test.

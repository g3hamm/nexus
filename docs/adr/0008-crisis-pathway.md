# 8. The crisis pathway runs on static data, not on models

Status: **Accepted** — 2026-08-28

## Context

Nexus invites anonymous strangers, worldwide, to say what is on their mind.
Some of them will be about to hurt themselves. That is not an edge case to be
handled later; it is a predictable consequence of the front door we built.

Before this, the platform's entire response to someone at risk was a line of
advice in the volunteer's sidebar telling them to stop doing apologetics.
Three things were wrong with that:

1. **The seeker was shown nothing.** No emergency number, no helpline, in any
   language. The one person who could act immediately — themselves — was the
   only one not given anything to act on.
2. **The code lied.** The volunteer was told "an administrator has been
   alerted" when nothing existed to alert one. The flag went into a queue that
   somebody might open the following day.
3. **Nothing survived a reload.** The state lived in a realtime notice, so a
   dropped connection erased it.

## Decision

A crisis pathway with three parts, deliberately built so that the most
important one depends on nothing.

**Resources are static data in `@nexus/core`.** A verified per-country table of
emergency numbers and helplines, a hand-written string table in 19 languages,
and an international directory that is always shown. No model call, no network
call, no database read. The worst moment in this product is the wrong moment to
depend on an API being up — this renders when the LLM provider is down, when
translation fails, and when the realtime transport has dropped.

**Crisis state lives on the conversation, not on the wire.** `escalate_crisis`
stamps `conversations.crisis_raised_at`, and the transcript endpoint returns
the resources alongside the messages. So it survives a reload, a new device,
and a failed WebSocket — the same reasoning that already put messages on the
polling fallback rather than trusting a data packet.

**Alerts are a port with a webhook adapter.** `AlertChannel` reaches a human
outside the app — a Teams or Slack channel the church already watches. It is
used for risk to life and nothing else. Every other category the judge raises
goes to the flag queue, because paging people for solicitation and off-topic
drift trains everyone to ignore the pager.

## Consequences

**The alert cannot carry the conversation.** `OperationalAlert` has nowhere to
put a transcript, and the webhook adapter collapses and caps `detail` as a
second line of defence. Alerts land in third-party chat tools that sit outside
our encryption, outside our retention policy, and in front of everyone in the
channel. An alert says *that* something is happening and *where to look*; the
content stays encrypted behind the admin login. This is tested by asserting
that a rationale quoting the seeker does not appear in the serialised alert.

**The volunteer is told the truth about who is coming.** With a webhook
configured: "An administrator has been alerted." Without one: "nobody has been
paged — right now you are the person here." A church running without a webhook
is a supported configuration; software that misrepresents whether help is
coming is not.

**The seeker's country is read and thrown away.** Taken from the edge header on
their own request to pick a helpline list, never written to the database, never
attached to the conversation, never included in an alert or an audit entry. A
stored "this conversation came from Iran" beside an encrypted transcript is
exactly the metadata this product is built not to accumulate, and it would
outlive the transcript's own deletion. The cost is that the volunteer's card
shows only the international directory — they can ask where someone is, which
is a better conversation anyway.

**Countries are missing on purpose.** Where discussing conversion carries legal
risk, we do not point someone at a state-operated line minutes after a
conversation about faith. Those seekers get the international directory, which
lets them choose for themselves. Entries also carry a `verifiedOn` date,
because a helpline number nobody has checked in two years is a liability and
dating them makes that visible rather than silent.

**A wrong number is worse than no number.** The table is short and
high-confidence rather than exhaustive; every seeker gets the maintained
international directory regardless. An omission degrades gracefully. An error
does not.

## What this does not do

It does not decide policy. Who is on call, what the church's obligations are
when a disclosure arrives from a jurisdiction none of its staff are in, and
what happens with a minor are questions for the ministry, not the codebase.
This gives those decisions somewhere to land; it does not make them.

It does not detect anything new. Detection is the existing judge plus the
scheduler's urgent-phrase tripwire, which already pulls a review forward the
moment risk language appears in any language, since every message carries an
English rendering. What changed is what happens next.

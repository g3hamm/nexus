# 9. Practice runs on the real surface, and the partner does not soften

Status: **Accepted** — 2026-08-28

## Context

Twenty volunteers, most of whom have never done this, are going to start
having private conversations with distressed strangers through a translator.
The first hostile message, the first "your God let my son die", the first time
somebody says they are not sure they will be here tomorrow — each of those is
going to happen to a real person on the other end unless it happens somewhere
else first.

## Decision

**A practice session is a real conversation row on the real surface.** Same
`ChatWindow`, same translation, same scripture hover, same crisis card, same
everything. A `practice_scenario` column is the only difference, and its
presence is what marks the conversation as an exercise.

The alternative — a purpose-built mock chat — is less code and much less
useful. Rehearsing on a mock teaches the mock. A volunteer who has practised
in a simplified pane meets the actual product for the first time with a real
person waiting on the other end of it.

**The partner is instructed not to soften.** The overwhelming failure mode of
an LLM asked to play someone difficult is that it becomes agreeable within
three turns, rewards effort, and lets itself be persuaded by an argument that
would persuade nobody. That produces a volunteer with false confidence, which
is strictly worse than a volunteer with none. Every scenario lists what makes
its character disengage, and the prompt says in as many words: do not reward
effort that would not be rewarded in life.

**Scenarios are mostly not in English.** Eight of the nine are in a language
the volunteer almost certainly does not read. Feeling the delay, watching a
reply arrive in a script you cannot scan, and finding that your idiom did not
survive the trip are all part of this work and none of them can be practised
in English. The ninth is in English on purpose, so the interpersonal part can
be worked on with the translation friction removed.

## Consequences

**Moderation skips practice entirely, and that is load-bearing.** The
scenarios are deliberately hostile and one is built to reach a disclosure of
self-harm. Without the early return in `ModerationService.reviewIfDue`, the
sandbox would fill the admin flag queue with exercises, exempt rehearsals from
the retention purge (a raised flag nulls `retain_until`), and — the one that
matters — fire a crisis webhook and wake somebody at two in the morning over a
volunteer practising. There is a test asserting all four.

**The crisis card still appears, raised directly.** The partner returns a
`disclosesRisk` flag per turn and `PracticeService` stamps
`crisis_raised_at` from it, with no judge, no flag, and nobody paged. The
volunteer's banner says plainly that this is practice and that nobody has been
alerted — training someone to be reassured by a page that did not happen would
be its own kind of harm.

**Practice transcripts are encrypted like any other.** A volunteer's fumbling
first attempt at the self-harm scenario is not something to leave in plaintext
for the next administrator to browse. They retain for fourteen days rather than
ninety.

**The debrief is generated and returned, never stored.** It is read once, by
one person. Keeping a standing file of assessments of volunteers is a
different and much more sensitive thing than running a training exercise, and
it should be a ministry's deliberate decision rather than a side effect of
this feature. The audit log records that a debrief happened and its readiness
band; it does not record a word of what the coach said.

**Readiness is three coarse bands, not a score.** A number invites volunteers
to optimise it and administrators to rank people by it. This exists to make
someone better at sitting with a grieving stranger.

**Harms are a separate list from growth.** Pressure, guilt, promising an
outcome, offering material help, suggesting a private channel, continuing with
apologetics after a disclosure of risk — these never get folded into "things
to work on", because softening them is exactly how they get skimmed past. An
empty harms list is the normal result and the prompt says so, so the coach
does not manufacture one to look rigorous.

**Every scenario costs model calls.** A session is roughly a dozen, plus a
long debrief. `practice.start` is the tightest rate limit in the product for
that reason: it is the only action a signed-in volunteer can take that spends
budget on demand.

## What this does not do

It does not certify anyone. A single exercise is thin evidence, the rating is
written for a human to read rather than a system to act on, and nothing in the
platform gates a volunteer on it. Deciding who is ready is a job for the people
who know them.

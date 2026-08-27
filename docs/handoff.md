# Handoff guide

For the team taking Nexus on. This says what is real, what is not, what to
build next and in what order, and which decisions you should feel free to
overturn.

## What is actually working

- The monorepo, with every module contract defined in `@nexus/core`.
- Envelope encryption, with 16 tests including tamper and cross-conversation
  cases.
- The full database schema for Neon Postgres, including the knowledge-base
  tables and their pgvector index.
- A swappable LLM layer with schema-validated structured output and a tested
  retry loop.
- Glossary-aware translation.
- LiveKit realtime, with the video seam already in place.
- Authentication for volunteers, anonymous sessions for seekers.
- **One end-to-end path**: a seeker arrives writing any language, is matched to
  a volunteer, and both hold a live translated conversation. 14 tests cover it.

`pnpm verify` runs typecheck, lint, tests, and build across everything.

## What is scaffolded and not implemented

Four packages have settled contracts and no behaviour. Each one's `index.ts`
records the decisions already taken — read it before designing:

| Package             | What is missing                         |
| ------------------- | --------------------------------------- |
| `@nexus/bible`      | Passage lookup and reference detection  |
| `@nexus/knowledge`  | Chunking, embedding, pgvector retrieval |
| `@nexus/enablement` | The sidebar's three panels              |
| `@nexus/moderation` | The judge and its scheduling            |

They are already constructed in `container.ts`, so the wiring points exist.

## Known gaps — read this section first

These are things that look done and are not:

1. ~~The retention purge job does not exist.~~ **Built**, and now closed-loop:
   reviewing a flag restores `retainUntil` (90 days if dismissed, a year if
   upheld), so a flagged conversation is exempt from the purge only until a
   human has actually looked at it. A daily Vercel Cron
   hits `/api/cron/purge`, which hard-deletes conversations past
   `retainUntil` — never anything live, under review, or carrying an
   unresolved flag. Deleting the conversation row destroys the only copy of
   its wrapped data key, so any ciphertext that outlives the delete in a
   replica or backup is undecryptable rather than merely unlinked. Requires
   `CRON_SECRET`; the endpoint fails closed without it.
2. ~~No admin surfaces.~~ **Built.** `/admin` is the review queue, with
   audited transcript review, flag resolution, and volunteer approval.
   `AdminService.transcriptFor` is the only way to read a conversation as an
   admin and writes `conversation.viewed` before returning a single message.
3. **No volunteer provisioning UI.** `pnpm seed:volunteer` creates and
   _immediately approves_ an account, which is what makes the app usable at
   all today — but it bypasses the vetting step that is the actual safety
   model. A real signup path plus an admin approval screen is wave-two work,
   and until it exists the seed script is the only door in.
4. ~~No rate limiting anywhere.~~ **Built.** Postgres-backed fixed windows on
   seeker start, message send, both sign-ins, and volunteer applications.
   Counters are keyed on an HMAC of the caller's address, never the address
   itself, and swept nightly by the purge.
5. **No password reset, no MFA.** An admin account is a key to every transcript.
   MFA for admins should not wait long.
6. **The Drizzle repositories have no test coverage at all.** Everything else
   in the suite runs against fakes, and the fakes are tested — but no test
   ever executes the real SQL. This is not theoretical: a `create({ approved:
true })` flag was accepted by the signature and silently dropped by the
   INSERT, and nothing caught it until a human could not sign in. The obstacle
   is that `NexusDatabase` is bound to Neon's HTTP driver, so the repositories
   cannot be pointed at a local Postgres. Worth fixing by parameterising the
   driver so the same repository code can run against `node-postgres` in
   tests, then adding a contract test that both the fakes and the real
   repositories must pass.
7. **`InMemoryTransport` and `FakeLlmProvider` are development-only.** Both
   factories refuse them when `NODE_ENV=production`, as does local key
   management. If you add a provider, add the same guard.

## Suggested order

**Before anything else**

1. ~~Rate limiting.~~ **Built.**
2. A real volunteer signup and admin approval flow, replacing the seed script
   (see gap 3).

**Wave two, roughly in dependency order**

4. `@nexus/knowledge` — chunking, an embedding provider, retrieval. The
   sidebar is not worth building before this, because a sidebar without
   citations is a sidebar that improvises theology.
5. `@nexus/moderation` — the judge. Ship it before the sidebar: the platform
   needs to be watching conversations before it starts shaping them.
6. ~~`@nexus/enablement` — the sidebar.~~ **Built.** Refreshes only when the
   volunteer asks, to control both cost and the panel changing under someone
   mid-thought.
7. ~~`@nexus/bible` — lookup and detection, then the hover interaction.~~
   **Built.** Detection covers English, Spanish, Portuguese and French; adding
   a language means a native speaker supplying the book names and the
   abbreviations people actually write.
8. ~~Admin surfaces.~~ **Built.**

**Later**

9. Voice and video. See `docs/architecture.md` — the seam is already there.
10. Per-language glossary review. `GlossaryEntry.senses` is deliberately sparse;
    only entries a native speaker has confirmed belong in it. This is
    native-speaker work, not engineering work.

## Conventions worth keeping

- **Add a port before adding a package.** `@nexus/core` defines the interface,
  a package implements it, `container.ts` chooses. Feature code never imports a
  vendor SDK.
- **`@nexus/core` depends on nothing but zod.** Keep it that way.
- Packages use `NodeNext` resolution — relative imports carry `.js`.
  `apps/web` uses bundler resolution — relative imports do **not**. This bites
  everyone once.
- Repositories take and return domain objects. Encryption lives inside them, so
  there is no code path where someone forgets.
- Errors are `NexusError` with a typed code. Routes map codes to HTTP via
  `httpStatusFor`. Unexpected errors never reach the client — a stack trace
  from a failed decrypt can describe conversation content.
- Tests use the fakes in `apps/web/src/test/fakes.ts` and the per-package fake
  providers. None of the test suite needs a database, a key, or a network.

## Things to feel free to overturn

- **scrypt authentication** (ADR 5). Written to be replaced. If you need SSO or
  enforced MFA, swap it.
- **Task-to-model routing defaults.** Every task defaults to the most capable
  model because cost is an operator's decision, not ours. Tune
  `NEXUS_MODEL_*` with real traffic in front of you.
- **The 90-day retention default.** A number had to be chosen. Yours is
  probably better.
- **The ecumenical doctrine profile** (ADR 4) is config, not code, precisely so
  a ministry can change it.

## Things not to overturn casually

- **Seekers have no accounts and no durable identity.** Not an oversight, and
  not a feature gap to be closed. ADR 3 explains what is at stake.
- **Application-layer encryption.** Provider at-rest encryption is not a
  substitute, and the reasoning is in ADR 3.
- **The judge is advisory below crisis level.** An LLM should not be quietly
  ending conversations about faith because it misread an idiom in a language it
  handles poorly.
- **The sidebar offers; it never speaks.** Nothing in the enablement panel may
  post to a conversation. The seeker came to talk to a person.

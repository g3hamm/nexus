# Nexus

An international chat where anyone, anywhere, can talk with a Christian
volunteer — each side writing in their own language.

Three kinds of people use it:

- **Seekers** need no account. They arrive, write something in whatever
  language they think in, and are connected to a person. Nothing else is asked
  of them.
- **Volunteers** have accounts, are approved by an admin before they can be
  matched, and are supported by an AI sidebar that offers scripture,
  discussion points, and a read on who they are talking to.
- **Admins** review flagged conversations and audit transcripts. Every audit
  read is itself recorded.

## Status

Wave one is built and green: the monorepo, every module contract, the database
schema, encryption, and **one working end-to-end path** — a seeker arrives,
gets matched to a volunteer, and the two hold a live translated conversation.

Wave two is scaffolded with settled contracts and no implementation: the
enablement sidebar, the moderation judge, the knowledge base, and Bible
lookup. Each lives in its own package with the design decisions written down.

## Getting started

```bash
pnpm install
cp .env.example .env.local     # then fill it in
pnpm db:generate && pnpm db:migrate
pnpm dev
```

You can run the whole app without any third-party credentials:

```bash
NEXUS_LLM_PROVIDER=fake NEXUS_REALTIME_PROVIDER=memory pnpm dev
```

You still need a `DATABASE_URL`, a `NEXUS_MASTER_KEY`, and a
`NEXUS_SESSION_SECRET`. Generate the last two with `openssl rand -base64 32`.

## Verifying

```bash
pnpm verify      # typecheck, lint, test, build across every package
```

## The stack, and why

| Concern    | Choice                            | Why                                                                                                                      |
| ---------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Hosting    | Vercel                            | Next.js App Router, edge presence near seekers.                                                                          |
| Database   | Neon Postgres                     | Real Postgres with pgvector, scales to zero, no monthly minimum. Turso's Postgres is experimental until ~2027.           |
| Realtime   | LiveKit Cloud                     | Vercel's WebSockets cap at 5 min and don't fan out. LiveKit's rooms carry voice and video later with no re-architecture. |
| LLM        | Anthropic, behind a port          | Swappable at one line in the container; every flow uses schema-validated structured output.                              |
| Encryption | AES-256-GCM envelope, KMS-wrapped | Provider at-rest encryption doesn't protect transcripts from a leaked connection string.                                 |
| Auth       | scrypt + signed cookies           | Volunteers are a small vetted population; seekers deliberately have no accounts.                                         |

Each of these is written up properly in [`docs/adr/`](docs/adr/).

## Repository layout

```
apps/web              Next.js app: seeker chat, volunteer console, API routes
packages/core         Domain model and EVERY module contract. Depends on nothing but zod.
packages/crypto       Envelope encryption. AES-256-GCM data keys wrapped by a KMS master key.
packages/db           Neon Postgres schema and repositories. Encrypts at the boundary.
packages/llm          Swappable LLM providers, structured output, retries.
packages/translation  Translation that keeps Christian vocabulary intact.
packages/realtime     LiveKit transport. Text now, voice and video later.
packages/auth         Volunteer/admin auth and anonymous seeker sessions.
packages/ui           Design tokens and shared primitives.
packages/bible        SCAFFOLD — scripture lookup and reference detection.
packages/knowledge    SCAFFOLD — apologetics knowledge base over pgvector.
packages/enablement   SCAFFOLD — the volunteer sidebar.
packages/moderation   SCAFFOLD — the judge.
```

The one rule that keeps this modular: **`packages/core` defines the interface,
a package implements it, and `apps/web/src/server/container.ts` is the only
file that knows which implementation is in use.** Feature code never imports a
vendor SDK.

## Further reading

- [Architecture](docs/architecture.md) — how a message actually flows
- [Handoff guide](docs/handoff.md) — for the team taking this on
- [Decision records](docs/adr/) — why things are the way they are

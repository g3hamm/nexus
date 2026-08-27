# 1. Neon Postgres, not Turso

Status: **Accepted** — 2026-08-27

## Context

The original intent was Turso Postgres. Turso announced in July 2026 that they
are building Postgres in Rust; their repository still marks Postgres support as
_experimental_, with a realistic path to production quality in 2027. Turso's
SQLite/libSQL product is production-ready today, but that is a different
product from what was asked for.

Nexus also needs vector search for the apologetics knowledge base, where
pgvector is by a wide margin the most mature option.

The cost question was asked directly, so it was answered directly:

|          | Neon                                                                  | Supabase                               |
| -------- | --------------------------------------------------------------------- | -------------------------------------- |
| Floor    | **$0/mo** — no monthly minimum since Dec 2025, compute scales to zero | **$25/mo** — paid compute is always-on |
| Compute  | $0.106/CU-hour (Launch)                                               | Included tier + add-ons from $10/mo    |
| Storage  | $0.35/GB-month                                                        | 8 GB included on Pro                   |
| Realtime | n/a                                                                   | 500 concurrent connections on Pro      |

## Decision

Neon Postgres, accessed with Drizzle ORM over the `@neondatabase/serverless`
HTTP driver.

## Rationale

- **Cheaper at our stage, and it is not close.** Scaling to zero matters for a
  service whose traffic follows time zones and will be quiet for hours.
- **pgvector** is a first-class citizen. The knowledge base needs it.
- **Plain Postgres** is the least surprising thing to hand a larger team.
- **Compliance posture:** HIPAA with BAA, SOC 2 Type 1 and 2, ISO 27001/27701,
  GDPR/CCPA, with keys in AWS KMS / Azure Key Vault.
- **The Supabase bundle argument evaporated** once LiveKit was chosen for
  realtime. What remained was Auth and Storage — and Nexus does not need
  MAU-scale auth, because seekers deliberately have no accounts and volunteers
  are a vetted population in the hundreds.
- Supabase's column-encryption path is **pgsodium, which Supabase now
  explicitly recommends against for new use** and is deprecating. It offered no
  advantage on the requirement that actually mattered.

## Consequences

- We lose Turso's embedded-replica read latency. Acceptable: the latency a
  seeker actually feels is dominated by the translation round trip, not by
  Postgres.
- The HTTP driver has no multi-statement transactions. This costs nothing —
  the only operation needing atomicity (claiming a waiting conversation) is a
  single conditional UPDATE, which is both simpler and correct under
  concurrency.
- Embedding width is fixed at 1024 in the schema. Changing it is a migration,
  not a config change, because pgvector fixes the column.

## Revisiting

Worth reopening if Turso Postgres reaches GA and the edge-replica latency
becomes the dominant term in the response time — which it will not while every
translated message involves a model call.

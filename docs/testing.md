# Testing

```bash
pnpm test      # everything that needs nothing
pnpm verify    # typecheck, lint, test, build
```

Most of the suite runs against in-memory fakes: no database, no keys, no
network. That is deliberate — those tests are fast enough to run constantly.

## Repository integration tests

One suite is different. `packages/db/src/repositories/integration.test.ts`
runs the real repositories against a real Postgres, applying the same
`docs/setup.sql` that operators paste into Neon.

```bash
./scripts/test-db.sh
```

That starts a throwaway Postgres (Docker if available), points
`TEST_DATABASE_URL` at it, runs the suite, and tears it down. To use a
database you already have:

```bash
TEST_DATABASE_URL=postgresql://... pnpm --filter @nexus/db test
```

Without `TEST_DATABASE_URL` the suite **skips and says so**. A silently empty
suite is how the gap it exists to close survived as long as it did.

### Why it exists

Repositories had no test coverage at all. Everything ran against fakes, so no
test ever executed a statement, and two real bugs reached a user as a result:

- `create({ approved: true })` was accepted by the signature and dropped by
  the INSERT, so first-run setup reported success and the account could not
  sign in.
- Conversation data keys were wrapped under one encryption context and
  unwrapped under the caller's, so **every moderation flag silently failed to
  persist** — invisible, because moderation failures are deliberately
  swallowed rather than shown to the two people talking. The integration
  suite caught this on its first run.

Both are now regression tests.

### What it covers that a fake cannot

- Correlated subqueries — the volunteer concurrency cap, the `not exists`
  guard that keeps flagged conversations out of the purge.
- SQL `CASE` expressions — deriving a conversation's status when retention is
  restored after review.
- Real concurrency — two volunteers claiming one conversation at the same
  instant, and the rate limiter's upsert under parallel requests.
- That ciphertext columns really are unreadable, by selecting them raw.
- That the rate-limit table really holds no recoverable IP address.
- Cascading deletes.

### Adding to it

Reach for the integration suite whenever behaviour lives in SQL rather than in
TypeScript: a subquery, a `CASE`, an `ON CONFLICT`, a constraint, a cascade,
anything concurrent. If a fake could express it faithfully, a fake is fine and
faster.

Each test truncates first, so they are order-independent and can be run
individually.

# 5. Built-in authentication, not a managed identity provider

Status: **Accepted** — 2026-08-27

## Context

Volunteers and admins need accounts. Seekers deliberately must not have them.

The obvious options were Auth.js v5 (still beta), Clerk, WorkOS, or Supabase
Auth — the last of which stopped being interesting once Neon was chosen for the
database and LiveKit for realtime.

## Decision

Implement authentication in `@nexus/auth`:

- **Passwords:** scrypt from Node's standard library (N=32768, r=8, p=1), with
  parameters stored alongside each hash so they can be raised later without
  invalidating existing passwords. Constant-time comparison.
- **Sessions:** signed JWTs via `jose`, in httpOnly, `SameSite=Lax` cookies,
  `Secure` in production.
- **Seekers:** the same signing machinery issues a token carrying a random
  per-visit handle and a language. No account row. No database write that
  identifies them.

## Rationale

- Volunteers are an **invite-only, admin-approved population in the hundreds**,
  not a consumer signup funnel. The usual reasons to buy identity — social
  login, SSO, MFA, MAU-scale pricing, bot signups — mostly do not apply yet.
- Auth.js v5 is still in beta. A repository about to be handed to another team
  should not have a beta dependency on its authentication path.
- scrypt is built into Node, so there is **no native module to compile** and
  nothing to break on a Vercel build.
- Seeker anonymity is a first-class safety property here, not a preference.
  Owning the session layer is what makes "issue a session with no account
  behind it" trivial rather than a fight with a vendor's user model.

## Security notes

- Login verifies against a **dummy hash of identical cost** when no account
  exists, so response timing does not reveal which email addresses belong to
  volunteers. For this platform that list is worth protecting.
- The login response never distinguishes "no such account" from "wrong
  password". It _does_ distinguish suspended and awaiting-approval, because a
  volunteer needs to understand those.
- Unapproved volunteers cannot be matched. Vetting who speaks to seekers is the
  safety model.
- Failed and successful logins both go to `audit_log`.

## Consequences

- No SSO and no social login. Both remain reasons to move to a managed
  provider; neither is needed yet.
- We own this code, which means we own its bugs.

## Added since

**MFA for admins** (TOTP, RFC 6238). Implemented rather than imported: the
specification is short, completely pinned down, and — decisively — ships
published test vectors, so the implementation is _proved_ correct rather than
trusted. `totp.test.ts` runs the RFC's own vectors for both HOTP and TOTP.
That is a better position than an unaudited dependency in the admin
authentication path.

Seeds are encrypted at rest under a key derived from `NEXUS_SESSION_SECRET`
through HKDF, so a leaked database does not hand over password hashes _and_
the factor meant to survive them. Enrolment and enabling are separate steps —
a secret is stored when the QR is shown, but nothing takes effect until a code
is verified, so an abandoned setup cannot lock anyone out.

Ten recovery codes are issued on enabling and shown once. Without them,
turning MFA on would be a way to lose access to every transcript on the
platform permanently. They are hashed with HMAC-SHA256 rather than scrypt,
deliberately: scrypt is slow because passwords are low-entropy, and these are
80 random bits, so the cost buys nothing.

**Password reset**, in two forms, neither of which invents an email
dependency:

- An administrator issues a one-time code for a volunteer and passes it on
  however they already communicate. For a small vetted volunteer base that is
  workable, and a code handed over in a conversation you were already having
  is arguably harder to intercept than a link sitting in an inbox.
- `pnpm reset:password` for the cases the UI cannot reach — an administrator
  who has forgotten their own password, or one locked out by a lost second
  factor with no recovery codes left. The bar is database credentials, which
  is the right bar for something that restores access to every transcript.

A self-service reset by email remains unbuilt, and needs an email provider
before it can exist.

## When to revisit

Move to a managed provider when any of these becomes true: partner ministries
need SSO, the volunteer base outgrows manual provisioning, or compliance
requires enforced MFA and session management you would rather not build. The
`@nexus/auth` boundary is small and the swap is contained.

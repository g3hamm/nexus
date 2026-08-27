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

- No SSO, no MFA, no social login today. MFA for admins is the first thing to
  add — an admin account is a key to every transcript.
- No password reset flow yet. Admins provision volunteers.
- We own this code, which means we own its bugs.

## When to revisit

Move to a managed provider when any of these becomes true: partner ministries
need SSO, the volunteer base outgrows manual provisioning, or compliance
requires enforced MFA and session management you would rather not build. The
`@nexus/auth` boundary is small and the swap is contained.

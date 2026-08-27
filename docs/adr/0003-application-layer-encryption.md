# 3. Application-layer envelope encryption for conversation content

Status: **Accepted** — 2026-08-27

## Context

The requirement was that everything be encrypted. Neon already encrypts at
rest with AES-256 and in transit with TLS 1.2+, and that is table stakes — but
it protects against a stolen disk and very little else. It does **not** protect
transcripts from:

- a leaked or committed connection string,
- a compromised read replica,
- an employee at the database provider,
- an admin browsing the audit UI with no record that they did.

Nexus's threat model is unusual and worth stating plainly. A seeker in Iran,
Afghanistan, Somalia, or northern Nigeria asking questions about Jesus is
creating a record that could see them imprisoned, disowned, or killed. The
consequence of a transcript leak here is not reputational.

## Decision

Encrypt message content and moderation rationales at the **application layer**,
above the database, using envelope encryption:

- Each conversation gets its own AES-256 data key (DEK).
- The DEK is wrapped by a master key held in a KMS and stored only in wrapped
  form, in the conversation row beside the ciphertext.
- The conversation id and a purpose discriminator are bound into every
  ciphertext as additional authenticated data.
- Encryption happens inside the repositories, at the database boundary, so no
  feature code can forget to do it — and the schema has no column capable of
  holding readable message text.

`LocalKeyManagement` reads the master key from an environment variable for
development. `createKeyManagement` **refuses to start** if that is still
selected when `NODE_ENV=production`, because everything keeps working when it
is misconfigured and nobody would notice.

## What this protects against

A leaked connection string, a stolen backup, a compromised replica, a curious
provider employee, an unaudited `SELECT *`.

## What this does NOT protect against

Compromise of the running application. Nexus must hold unwrapped keys to
translate messages and moderate conversations at all, so an attacker with code
execution in the app can read what the app can read.

This is stated bluntly because the alternative — end-to-end encryption between
seeker and volunteer — is genuinely incompatible with the product. Translation,
the enablement sidebar, the judge, and admin audit all require server-side
plaintext. Claiming E2E while doing this would be worse than not claiming it.

## Consequences

- **No SQL search over message text.** Admin search must work over metadata,
  or over a separate index built deliberately with its own threat model.
- Unwrapped DEKs are cached in memory (256 entries, 5-minute TTL). Without it a
  200-message transcript costs 200 KMS calls. This widens the window in which
  key material is resident, which the threat model above already accepts.
- Key rotation is a KMS policy change plus re-wrapping DEKs, not a
  re-encryption of every message. `CipherText.keyId` and `version` exist to
  make that migration possible.
- Every admin read of a transcript is written to `audit_log`. "Admins can audit
  conversations" and "admins are themselves audited" have to be the same
  feature, or the audit trail protects only the people who are not looking.

## Related, still open

Retention. Conversations carry `retainUntil`, defaulted to 90 days and cleared
when a flag is raised so anything under review outlives the window. **The purge
job that acts on it is not built.** Until it is, the column is a statement of
intent rather than a control. This should be wave two's first task, not its
last.

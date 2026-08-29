# 6. Public-domain scripture bundled, API.Bible optional

Status: **Accepted** — 2026-08-27

## Context

Nexus detects scripture references in messages and shows the passage on hover
or double-click, in the reader's preferred language.

Most modern translations are copyrighted. NIV, ESV, NASB, and their equivalents
in other languages are licensed per-translation and per-use, and several
prohibit exactly the kind of API redistribution a chat app performs. This is a
legal question before it is a technical one.

## Decision

A layered `BibleProvider`:

1. **`DatabaseBibleProvider`** — public-domain text a ministry has vetted and
   loaded itself with `pnpm bible:load`. No key, no outbound request, no
   licensing exposure.
2. **`BundledBibleProvider`** — the World English Bible, in the repository.

   This has changed its mind twice. It first said "shipped with the app", then
   moved to the database on the grounds that a full translation is several
   megabytes and bundling that into a serverless function to serve one verse
   is the wrong shape. That reasoning was sound and the conclusion was wrong,
   because it optimised the wrong thing. A floor that only exists after
   somebody runs a terminal command is not a floor — and in practice nobody
   ran it, so for most of this project's life scripture lookup returned
   nothing at all while every layer above it reported working correctly.

   Four megabytes, parsed once on the first lookup and never at import time,
   costs about thirty milliseconds. An empty database costs the feature. The
   WEB is public domain worldwide with no attribution required, so there is no
   licence to breach by shipping it, and it is modern English rather than
   Jacobean.

   It is one translation in one language, and it sits underneath the other two
   so that a better answer wins whenever one exists.

3. **`ApiBibleProvider`** — scripture.api.bible for the long tail: 2,500+
   versions across 1,600+ languages. Requires `API_BIBLE_KEY`, and is entirely
   optional. Each version carries its own attribution and usage restrictions.
4. **`CompositeBibleProvider`** — tries them in order of how good an answer
   they can give this particular reader: the remote catalogue, then the
   ministry's own translations, then the bundled WEB.

## Rationale

- **Scripture lookup must never fail because a third party is down, or
  because a deployment step was skipped.** A bundled floor guarantees both,
  and only the second of those was ever actually at risk.
- Public domain means zero legal exposure and full freedom to cache, index, and
  serve offline.
- The remote catalogue is where the language coverage actually is, and Nexus's
  whole premise is people who do not read English.
- Degrading coverage when a key is absent is far better than the feature
  breaking.

## Constraints for whoever implements this

- **Do not self-host copyrighted translations.** They are licensed
  individually, and several files circulating as free downloads are not
  actually public domain — NVI, RVR 1960, ARA, and the standard Korean and
  Portuguese revisions among them. Anything added to `src/data` has to be
  checked rather than assumed; `src/data/README.md` records where the WEB came
  from and how to rebuild it. `bible:load`
  refuses to run without an explicit `--public-domain` flag, so asserting it
  is a deliberate act by whoever loads the file rather than a default.
  `TranslationInfo.copyright` carries required attribution to the UI, and it
  must actually be rendered.
- Reference detection runs against the **original** text of a message, not a
  translation, so "Juan 3:16" is caught in the language it was typed in.
- `book` is an OSIS-style identifier so "Juan 3:16" and "John 3:16" normalise to
  the same reference and can be looked up in any translation.
- Detection must stay synchronous and cheap. It runs on every message.

## Consequences

- Public-domain coverage in many languages is thin or archaic. For those, the
  API is not optional in practice, and the UI must be honest when a passage is
  unavailable in someone's language rather than silently showing English.
- If a specific translation is wanted (a partner ministry's preferred version),
  that is a licensing conversation first and a small adapter second.

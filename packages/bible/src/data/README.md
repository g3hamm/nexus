# Bundled scripture

`web.json` is the **World English Bible**, and it is in this repository on
purpose.

Scripture lookup is supposed to have a floor that cannot go down — no API key,
no outbound request, no database, nothing that has to be true before it works.
ADR 6 originally put that floor in the database, loaded by a terminal command.
That was right about the shape and wrong about the consequence: a floor that
only exists once somebody runs a script is not a floor, and for most of this
project's life it was empty. Shipping the text means clone, deploy, and
scripture works.

**Licence: none needed.** The World English Bible is dedicated to the public
domain by its publisher, worldwide and without conditions. There is nothing to
attribute and no per-use terms, which is why `copyright` is null and the UI
renders nothing beside it.

That is a rarer property than it looks. Plenty of Bible files circulate as
though they were free and are not — NVI, RVR 1960, ARA, and the standard
Korean and Portuguese revisions among them. Anything added here has to be
checked, not assumed. `bible:load` exists for translations a ministry has
vetted itself and wants in the database; it demands an explicit
`--public-domain` flag for the same reason.

Regenerate with:

```bash
pnpm --filter @nexus/bible build          # the script reads dist/books.js
node packages/bible/scripts/build-web-json.mjs
```

The shape is `{ "<OSIS book>": [ ["verse 1", "verse 2", …], … ] }`, chapters and
verses zero-indexed. An empty string is a verse the WEB does not carry — a
handful of later manuscripts' additions — and the provider skips those rather
than rendering a blank line.

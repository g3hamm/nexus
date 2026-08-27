# Knowledge base content

Markdown documents loaded into the apologetics knowledge base with:

```bash
pnpm knowledge:load ./content/knowledge
```

**The `.md` files here are starter material, not a curated corpus.** They exist
so the volunteer sidebar has something real to retrieve and cite on day one,
and so the shape of a document is obvious. A ministry running Nexus should
replace them with material its own leadership has vetted.

Each file needs a header:

```
---
kind: objection_response
source: Author, Title (edition) — or the ministry that approved it
language: en
doctrineProfiles: ecumenical-creedal
---
# Title
```

`kind` is one of `apologetics`, `doctrine`, `objection_response`, `testimony`,
`practical_guidance`, `cultural_context`.

`source` is required and is **shown to volunteers**, who need to know whose
argument they are about to repeat. Leave `doctrineProfiles` empty for material
valid under any confession.

Re-running the loader updates documents in place; the id derives from the
filename, so renaming a file creates a second copy.

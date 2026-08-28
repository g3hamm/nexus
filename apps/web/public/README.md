# Images and static files

## What is in here now

| File | Where it appears |
|---|---|
| `olivechat-mark.webp` | Landing page, sign-in pages, application form |
| `olivechat-wordmark.webp` | Chat header (seeker's side), volunteer dashboard |
| `olive-upperleft.webp`, `olive-bottomright.webp` | Corner frame, desktop only |
| `nexus-logo.webp` | Attribution footer |

The originals were 5.7 MB of PNG; these are 300 KB of WebP at the sizes they
are actually displayed. If you replace one, resize it to roughly twice its
display size and export WebP — do not commit a 2000 x 2000 PNG for a box that
is 200 px wide.

The Nexus mark was supplied pale grey on transparent, drawn for a dark
background. It is inverted here so it reads on the warm canvas. If Nexus ever
supplies a dark version, use that instead.


Anything in this folder is served from the site root. `public/logo.svg` is
reachable at `/logo.svg`, and referenced in a component as:

```tsx
<img src="/logo.svg" alt="Nexus" />
```

Put brand images here: a logo, a wordmark, an illustration, anything a page
refers to by URL. **Do not put icons here** — see below, they belong somewhere
else and Next.js wires them up on its own.

## Icons go in `src/app/`, not here

Next.js recognises these by filename and puts the right tags in `<head>`
automatically. No code change, no import, nothing to register — drop the file
in `apps/web/src/app/` and it works on the next deploy.

| File | What it becomes | Suggested size |
|---|---|---|
| `icon.png` (or `.svg`, `.ico`) | Browser tab favicon | 512 × 512 |
| `apple-icon.png` | iOS home-screen icon | 180 × 180 |
| `opengraph-image.png` | The picture on a shared link | 1200 × 630 |

If both `icon.png` and a `favicon.ico` exist, the `.ico` wins. Pick one.

## Two things specific to Nexus

**Link previews are deliberately limited.** The root layout sets
`robots: { index: false, follow: false }` — a seeker may be somewhere this page
is best not advertised, and that decision predates any logo. An
`opengraph-image` still renders where someone pastes the link into a chat, but
this site is not meant to be found by searching.

**Keep files small.** Seekers arrive on cheap phones over slow mobile networks,
often the worst connection of anyone who will ever load this page. Prefer SVG
for anything flat — a logo, a wordmark — because it is usually a couple of
kilobytes and stays sharp at any size. For photographs use WebP, and keep them
under about 200 KB.

## Nothing here is private

This folder is public by definition: every file in it is downloadable by anyone
who guesses the URL, whether or not a page links to it. Never put a document,
an export, a screenshot of a conversation, or anything with a person's details
in here.

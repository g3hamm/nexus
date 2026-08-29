# Images and static files

One file: `nexus-logo.webp`, the Nexus Global Mission mark, shown as a credit
line at the foot of every page by `BrandFooter`. It is the inverted copy — the
supplied mark is pale grey drawn for a dark background, and inverting it once
at rest beats filtering it in CSS, which turns a textured mark to mud.

Nothing else, on purpose. The team has not settled on a brand for the product
itself, so the interface uses type and colour only and presumes nothing.

## When you do have artwork

Anything in this folder is served from the site root — `public/logo.svg` is
reachable at `/logo.svg` and referenced in a component as
`<img src="/logo.svg" alt="…" />`.

**Icons belong in `src/app/`, not here.** Next.js recognises these by filename
and writes the `<head>` tags itself — no code change, no import:

| File | Becomes | Size |
|---|---|---|
| `icon.png` (or `.svg`, `.ico`) | Browser tab favicon | 512 × 512 |
| `apple-icon.png` | iOS home-screen icon | 180 × 180 |
| `opengraph-image.png` | Picture on a shared link | 1200 × 630 |

## Two things specific to this product

**Keep files small.** Seekers arrive on cheap phones over slow mobile networks,
often the worst connection of anyone who will ever load this page. Prefer SVG
for anything flat; export photographs as WebP under about 200 KB. Resize to
roughly twice the display size — a 2000 × 2000 source for a 200 px box is
several megabytes spent on nothing.

**Nothing here is private.** Every file is downloadable by anyone who guesses
the URL, whether or not a page links to it. Never put a document, an export, or
anything about a person in this folder.

## The brand font, for whenever branding is decided

Bernoru was used for an earlier wordmark. If it comes back, keep it in the
artwork and out of `--font-sans`: a Latin display face cannot set text for a
product people write to in Farsi, Arabic, Chinese, Korean, Hindi and Russian.
See the comment on `--font-sans` in `packages/ui/src/tokens.css`.

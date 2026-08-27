# Function region

`vercel.json` pins Vercel Functions to **`cle1` (Cleveland)**, which is AWS
`us-east-2`.

That is not arbitrary. It must match the region your Neon database is in.
Neon's free tier only offers **AWS US East 2 (Ohio)** — also `us-east-2` — so
the functions are moved to meet it rather than the other way round. Vercel's
default is `iad1` (Washington, D.C., AWS `us-east-1`), which would put every
database call across a region boundary.

This matters more here than in a typical CRUD app. Sending one message touches
Postgres several times — load the conversation, fetch recent turns for
translation context, insert the message, read the wrapped key — and that
latency stacks up in the exact moment a seeker is watching the screen.

**The rule: the database region follows the compute region, and the compute
region follows the database's constraints. Neither follows your users.**
Seekers are worldwide but never talk to Postgres; only functions do. Vercel's
CDN handles global reach for everything static.

## If you move the database

Change both together. The mapping for the common cases:

| Neon region                  | Vercel region code |
| ---------------------------- | ------------------ |
| AWS US East 2 (Ohio)         | `cle1`             |
| AWS US East 1 (N. Virginia)  | `iad1`             |
| AWS US West 2 (Oregon)       | `pdx1`             |
| AWS Europe (Frankfurt)       | `fra1`             |
| AWS Europe (Ireland)         | `dub1`             |
| AWS Asia Pacific (Singapore) | `sin1`             |

Hobby and Pro plans can select any **single** region; only Enterprise can
select several. If Vercel ever ignores the `regions` key on your plan, set it
in the dashboard instead: **Settings → Functions → Function Region**.

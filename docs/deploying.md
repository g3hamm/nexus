# Deploying Nexus

Getting a working deployment you can actually talk to yourself on. Budget
about 30 minutes, most of it waiting on other people's signup forms.

> Prefer not to use a terminal? [setup-no-terminal.md](setup-no-terminal.md)
> covers the database and account steps entirely in a browser, using Neon's
> SQL Editor and a one-time `/setup` page.

## What you need to sign up for

| Service                                            | What for    | Cost to try                      |
| -------------------------------------------------- | ----------- | -------------------------------- |
| [Neon](https://neon.tech)                          | Postgres    | Free tier is plenty              |
| [LiveKit Cloud](https://cloud.livekit.io)          | Realtime    | Free tier is plenty              |
| [Anthropic Console](https://console.anthropic.com) | Translation | Pay-as-you-go, cents for a trial |
| [Vercel](https://vercel.com)                       | Hosting     | Free Hobby tier                  |

Your Claude Code subscription is **not** an API key. You need a separate one
from the Anthropic Console under API Keys.

---

## 1. Database

In the Neon console: create a project with **Postgres only** — leave Object
storage, Functions, AI gateway, and Neon Auth off. Nexus stores no files, runs
its compute on Vercel, reaches models through its own `LlmProvider` port, and
deliberately gives seekers no accounts at all.

**Region: AWS US East 2 (Ohio)**, which is the only choice on the free tier.
`apps/web/vercel.json` already pins Vercel Functions to `cle1` (Cleveland) to
match it — the two must be in the same AWS region or every database call
crosses a region boundary. If you move one, move the other; see
[apps/web/REGIONS.md](../apps/web/REGIONS.md).

Then **Connection Details → Pooled connection**. Take the **pooled** string —
it has `-pooler` in the host — and make sure it ends with `?sslmode=require`.

## 2. Realtime

In the LiveKit Cloud console: create a project, then **Settings → Keys**.
You need three values: the project URL (`wss://….livekit.cloud`), the API key,
and the API secret.

The browser never sees these. It asks Nexus for a token scoped to one room,
and gets the URL back with it.

## 3. Generate two secrets

```bash
openssl rand -base64 32   # NEXUS_MASTER_KEY
openssl rand -base64 32   # NEXUS_SESSION_SECRET
```

Different values. Keep the master key somewhere you will not lose it — **every
transcript is unrecoverable without it.**

## 4. Run the migrations

From your machine, against Neon. Nothing in the deploy does this for you.

```bash
git clone https://github.com/g3hamm/nexus.git && cd nexus
git checkout claude/christian-chat-app-r9fckb
pnpm install
cp .env.example .env.local        # fill in DATABASE_URL and the two secrets
pnpm db:migrate
```

That enables pgvector and creates all eight tables. To confirm it worked —
now or any time you are unsure which database you are pointed at:

```bash
pnpm db:check
```

It prints the host it connected to, whether pgvector is on, every expected
table, how many migrations have been applied, and whether an approved
volunteer exists. It never reads message content.

## 5. Create a volunteer

There is no signup or admin approval screen yet, so accounts come from a
script:

```bash
pnpm seed:volunteer --email you@example.org --name "Your Name" --languages en
```

It prints a generated password once. Save it.

## 6. Deploy to Vercel

Import the repo, then in **Settings → General**:

- **Root Directory:** `apps/web`
- Leave "Include source files outside of the Root Directory" **on** — the
  workspace packages live above it.

`apps/web/vercel.json` already sets the build command, the install command,
and the function region (`cle1`, to sit alongside Neon's Ohio), so you should
not need to override anything else.

If your plan ignores the `regions` key, set it under **Settings → Functions →
Function Region** instead. Hobby and Pro can each pick one region.

Set these environment variables (**Settings → Environment Variables**):

```
DATABASE_URL                     your pooled Neon string
NEXUS_SESSION_SECRET             second secret from step 3
NEXUS_MASTER_KEY                 first secret from step 3
NEXUS_KMS_PROVIDER               local
NEXUS_ALLOW_INSECURE_LOCAL_KMS   true
NEXUS_LLM_PROVIDER               anthropic
ANTHROPIC_API_KEY                sk-ant-…
NEXUS_REALTIME_PROVIDER          livekit
LIVEKIT_URL                      wss://….livekit.cloud
LIVEKIT_API_KEY                  API…
LIVEKIT_API_SECRET               your secret
```

### About `NEXUS_ALLOW_INSECURE_LOCAL_KMS`

Nexus **refuses to boot** in production with a master key sitting in an
environment variable, unless you set this. That guard is deliberate: the
failure it prevents is shipping on a throwaway key and never noticing,
because everything keeps working.

Setting it to `true` is fine for a trial and prints a warning on every boot.
Before real people use this, move to `NEXUS_KMS_PROVIDER=aws` with
`AWS_KMS_KEY_ID` — the adapter is already written, it is a configuration
change, not a code change. See [ADR 3](adr/0003-application-layer-encryption.md).

## 7. Try it

You need two browser sessions, because you are playing both parts. Use a
normal window and a private window — the seeker and volunteer cookies are
separate, but same-browser sessions are easier to confuse than they are worth.

1. **Private window** → your deployment's root URL. Write something in a
   language you do not speak. Spanish, Farsi, Korean, anything. Press Enter.
2. **Normal window** → `/volunteer/login`. Sign in with the seeded account.
3. You will see one person waiting, labelled with their language. Click
   **Talk with them**.
4. Reply in English. Watch it arrive translated in the private window, and
   watch theirs arrive in English in yours.
5. Click **Show original** under any translated message to see exactly what
   the other person typed.

If you want to see the glossary earning its keep, have the seeker write
something using _gracia_, _fe_, or _nacer de nuevo_ and check how it lands.

---

## Running locally with no third-party accounts

Useful for development. You still need a database and the two secrets, but no
LiveKit, no Anthropic key:

```bash
NEXUS_LLM_PROVIDER=fake NEXUS_REALTIME_PROVIDER=memory pnpm dev
```

Translation returns nothing in this mode, so messages arrive untranslated and
marked as such. Realtime falls back to the 3-second poll. Everything else
behaves normally.

---

## Troubleshooting

**"Refusing to start: NEXUS_KMS_PROVIDER is 'local' in production"**
Set `NEXUS_ALLOW_INSECURE_LOCAL_KMS=true`, or move to AWS KMS. See above.

**"Nexus is misconfigured"** with a list of variables
The env schema validates at boot and names exactly what is missing. Fix and
redeploy.

**Build fails resolving `@nexus/core`**
Root Directory is not `apps/web`, or "Include source files outside of the Root
Directory" is off.

**Everything works but feels sluggish**
Check that the Vercel function region and the Neon region are the same AWS
region. Ohio/`cle1` is the free-tier pairing. A mismatch puts every database
round trip across regions, and one message makes several.

**Not sure whether the migrations ran**
`pnpm db:check`. It answers the question directly rather than by inference.

**500 as soon as a seeker presses Enter**
Almost always missing tables. Run `pnpm db:check`, then `pnpm db:migrate`.

**Seeker sees their own message but the volunteer queue stays empty**
Either no approved volunteer exists (`pnpm db:check` will say so), or
migrations ran against a different database than Vercel is pointed at. Easy to
do with two Neon branches — compare the host `db:check` prints against
`DATABASE_URL` in the Vercel dashboard.

**Messages arrive but never translate**
Either `NEXUS_LLM_PROVIDER=fake`, or `ANTHROPIC_API_KEY` is missing or out of
credit. Translation failing never drops a message — it delivers the original
and marks it, so this looks like "it works but nothing translates".

**Realtime never connects**
Messages still arrive on the poll, just slower. Check `LIVEKIT_URL` starts with
`wss://` and that the key and secret are from the same project.

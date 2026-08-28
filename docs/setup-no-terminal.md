# Setting up Nexus without a terminal

You do not need the command line, and you do not need to edit a `.env` file.
That file is only for running Nexus on your own computer. Everything below
happens in a browser.

Two things are left after your Vercel deployment goes up: creating the
database tables, and creating your accounts.

---

> **Updating an existing install?** Two things.
>
> 1. Nexus has gained new database columns. Re-run Part 1 below — the file is
>    safe to run again and applies only what is new. Do this _before_
>    redeploying, or the app will error on every message.
> 2. If you set up before the administrator area existed, you have a volunteer
>    account and no administrator — which means the moderation queue is a room
>    nobody can enter. See **Adding an administrator** at the end of Part 2.

# Part 1 — Create the database tables

## Step 1. Copy the setup file

Open this page:

**https://github.com/g3hamm/nexus/blob/claude/christian-chat-app-r9fckb/docs/setup.sql**

Near the top right of the file there is a **copy icon** (two overlapping
squares). Click it. That copies the whole file.

If you cannot find the icon, click the **Raw** button instead, then select all
the text (Ctrl+A on Windows, Cmd+A on Mac) and copy it (Ctrl+C or Cmd+C).

## Step 2. Open Neon's SQL Editor

1. Go to **https://console.neon.tech** and sign in.
2. Click your **Nexus** project.
3. In the left sidebar, click **SQL Editor**.

You will see a large empty box with a **Run** button.

## Step 3. Paste and run

1. Click inside the big empty box.
2. Paste (Ctrl+V or Cmd+V).
3. Click **Run**.

It takes a few seconds. When it finishes you may see a few grey messages
mentioning "NOTICE" or "skipping" — those are fine. What matters is that
there is no red error box.

**If you are not sure whether it worked, just run it again.** The file is
built to be safe to run any number of times. A second run changes nothing.

## Step 4. Check the tables are there

In the left sidebar, click **Tables**. You should see eight:

```
admins            audit_log         conversations     knowledge_chunks
knowledge_documents   messages      moderation_flags  volunteers
```

If you see those eight, the database is done.

---

# Part 2 — Create your accounts

Seekers need no account, but you do — you are going to be the person on the
other end. There is a one-time setup page for this. It works once and then
closes itself permanently.

## Step 5. Make up a setup password

Think of a temporary password just for this. Anything you like, as long as it
is at least 8 characters — for example `setup-nexus-9134`. You will use it
once and then delete it.

## Step 6. Add it to Vercel

1. Go to **https://vercel.com** and sign in.
2. Click your Nexus project.
3. Click **Settings** at the top, then **Environment Variables** in the left
   sidebar.
4. Click **Add New**.
5. In the **Key** box type exactly: `NEXUS_SETUP_TOKEN`
6. In the **Value** box, type the password you just made up.
7. Make sure **Production** is ticked.
8. Click **Save**.

## Step 7. Redeploy

Vercel does not pick up a new variable until the next deploy.

1. Click **Deployments** at the top.
2. Find the deployment at the top of the list.
3. Click the **⋯** menu on its right-hand side.
4. Click **Redeploy**, then confirm.

Wait for it to say **Ready** — usually under two minutes.

## Step 8. Create your account

Go to your site's address with `/setup` on the end. For example:

```
https://your-project.vercel.app/setup
```

Fill in the form:

- **Setup token** — the password from Step 5.
- **Your name** — what a seeker sees while talking to you.
- **Email** and **Password** — how you will sign in from now on. The password
  must be at least 12 characters. A short phrase like
  `coffee harbour lantern` is both stronger and easier to remember than
  something like `Passw0rd!`.
- **Languages** — leave `en` unless you can genuinely hold a conversation in
  another language. It does not restrict who you are matched with; everything
  is translated either way.

Click **Create my accounts**.

This creates **two** accounts with the same email and password, because they
are two different jobs:

- `/volunteer/login` — talking with seekers.
- `/admin/login` — reviewing what the moderation AI flags, and approving new
  volunteers.

One browser holds one role at a time. To switch, just sign in at the other
address.

## Adding an administrator to an existing install

Skip this if you just did Step 8 — that already created both accounts.

If you set Nexus up before the administrator area existed, you have a
volunteer account and no administrator. That matters more than it sounds: when
the moderation AI flags a conversation it holds it open for review and exempts
it from the nightly deletion, so with no administrator those transcripts are
kept indefinitely and nobody can open them.

The fix is the same setup page — it stays open for exactly this case.

1. Add `NEXUS_SETUP_TOKEN` in Vercel and redeploy (Steps 6 and 7 above).
2. Go to `/setup`. It will say the install has a volunteer but no
   administrator.
3. Fill in the form. Use whatever email and password you like — this is a
   separate account from your volunteer one and does not have to match.
4. Sign in at `/admin/login`.
5. Remove `NEXUS_SETUP_TOKEN` again.

Your volunteer sign-in is untouched throughout.

## Step 9. Remove the setup token

The page has already closed itself, but leave nothing lying around.

Go back to **Settings → Environment Variables** in Vercel, find
`NEXUS_SETUP_TOKEN`, click the **⋯** next to it and choose **Remove**. No
redeploy needed.

---

# Part 3 — Try it

You are playing both people, so you need two browser windows that do not
share cookies.

1. **Open a private window.** Chrome and Edge call this Incognito; Safari and
   Firefox call it Private. Go to your site's main address.
2. **Write something in a language you do not speak.** Try
   `¿De verdad me escucha Dios?` — that is Spanish for "does God really hear
   me?" Press Enter.
3. You will land in a chat saying someone is being found for you. Leave that
   window open.
4. **In your normal window**, go to `/volunteer/login` and sign in with the
   email and password from Step 8.
5. You will see one person waiting, labelled with their language. Click
   **Talk with them**.
6. **Reply in English.** Watch it appear in Spanish in the private window.
   Whatever the seeker writes appears in English on your side.
7. Under any translated message, click **Show original** to see exactly what
   the other person typed.

That is the whole product working.

## Step 10. Look at the review queue

Sign in at `/admin/login` with the same email and password, and you will see
the moderation queue. It is probably empty, which is correct — the judge only
flags conversations when something is actually concerning.

It matters that this exists: when the judge does flag something, it holds that
conversation open for review and exempts it from the nightly deletion. Until
someone opens `/admin` and makes a decision, that transcript is kept
indefinitely. Reviewing a flag puts it back on a clock.

Every transcript you open here is recorded in the audit log against your name.
That is deliberate — admins can read everything, so admins are audited too.

---

# Adding more volunteers

You do not need a terminal for this either, and you should not use the seed
script for it — that one approves accounts automatically, which skips the
vetting that is the whole point.

Send people to `/volunteer/apply` on your site. They fill in a short form,
including a few sentences about themselves, and an account is created that
**can do nothing at all** until you approve it.

Then sign in at `/admin/login`, open **Volunteers**, and you will see them at
the top of the list with what they wrote. Approve, or leave them.

# Turn on two-factor authentication

Worth doing before anyone else uses Nexus. An administrator account opens
every transcript on the platform, so a stolen password is not one account's
problem — it is every seeker who has ever talked to you.

1. Sign in at `/admin/login`.
2. Click **Your sign-in**.
3. Click **Set it up**, scan the QR code with any authenticator app (Google
   Authenticator, 1Password, Bitwarden, Authy), and type the six-digit code it
   shows.
4. **Save the recovery codes it gives you.** They are shown once and cannot be
   retrieved — they are what stops a lost phone becoming a lost account.

If you lose both your phone and the codes, someone with database access can
run `pnpm reset:password --email you@example.org --role admin --clear-mfa`.

# Helping a volunteer who forgot their password

Nexus sends no email, so there is no "forgot password" link. Instead:

1. Sign in at `/admin/login` and open **Volunteers**.
2. Click **Reset password** next to them.
3. You are shown a code once. Pass it on however you already talk to them.
4. They enter it at `/volunteer/reset` with a new password.

The code works once and expires after 24 hours.

# If something goes wrong

**The `/setup` page says "Setup is switched off."**
`NEXUS_SETUP_TOKEN` is not set, or you have not redeployed since adding it.
Repeat Steps 6 and 7.

**The `/setup` page says "Setup is already done."**
An administrator already exists, so setup has closed permanently. Sign in at
`/volunteer/login` or `/admin/login`. If you have forgotten a password, see
below.

**"That setup token is not correct."**
The value in Vercel and what you typed do not match. Watch for a trailing
space when pasting into Vercel.

**The site errors as soon as you press Enter as a seeker.**
The tables are not there. Go back to Part 1 and check Step 4.

**You are stuck in the chat with "Finding someone to talk with you".**
That is correct and expected until you claim it as a volunteer in Step 5 of
Part 3. It is not an error.

**Messages arrive but never translate.**
Your `ANTHROPIC_API_KEY` is missing, wrong, or the account has no credit.
Check it in Vercel's environment variables. Nexus never drops a message when
translation fails — it shows the original and says translation is
unavailable, which can look like "it works but nothing translates".

**Sign-in says "This account is awaiting approval by an administrator."**
This was a bug in an earlier build: setup created the account but did not
mark it approved. Fix it in one line rather than starting over. In Neon's
**SQL Editor**, paste this and click **Run**, using your own email:

```sql
UPDATE volunteers SET approved_at = now() WHERE email = 'you@example.org';
```

Then sign in again. Redeploying your Vercel project first will also stop it
happening to any future account.

**Conversations are never deleted.**
`CRON_SECRET` is not set in Vercel, so the nightly cleanup refuses to run.
Add it (any long random string) under Settings → Environment Variables and
redeploy. Without it, every conversation is kept forever.

**Somebody forgot their password.**
See "Helping a volunteer who forgot their password" above — an administrator
issues a one-time code from the roster. If it is *your* administrator password
that is lost and two-factor is on, you need the recovery codes you were shown
when you turned it on.

---

# After updating Nexus

Two things to do whenever you deploy a newer version of the code.

## Making Bible references work

When somebody types "Numbers 31" or "John 3:16", olivechat underlines it and
shows the passage on hover. If instead you see **"No Bible text has been set up
on this site yet"**, that is exactly what has happened — the feature works,
there is simply no scripture for it to show. Nothing is broken.

There are two ways to give it some. The first needs no terminal.

### The easy way: a free API.Bible key

This is the better option anyway — it reaches languages that no
public-domain text covers, which matters for a product where seekers write in
Farsi, Arabic and Chinese.

1. Go to **scripture.api.bible** and create a free account.
2. Create an application when it asks. Copy the **API key** it gives you.
3. In Vercel: **Settings → Environment Variables → Add New**
   - **Key**: `API_BIBLE_KEY`
   - **Value**: the key you copied
   - Tick all three environments, then **Save**.
4. Redeploy (**Deployments → ⋯ on the newest → Redeploy**).

Hover a reference. It should now show the passage.

### The other way: load a public-domain translation yourself

This one needs somebody comfortable at a command line, and a downloaded
public-domain Bible file. It stores the text in your own database, so it keeps
working with no third party involved:

```
pnpm bible:load --file ./web.txt --translation WEB --language en --public-domain
```

Only public-domain translations may be loaded this way — the World English
Bible, the King James Version, the American Standard Version. The command
refuses to run without the `--public-domain` flag, on purpose: most modern
translations are copyrighted and self-hosting them is not something to do by
accident.

If you set up both, API.Bible is tried first and your own copy is the fallback,
so a bad afternoon at their end does not take scripture off the screen.

## If a page says the deployment is newer than its database

You will see: *"This deployment is newer than its database. Re-run
docs/setup.sql in the Neon SQL Editor, then reload."*

That is exactly what to do, and nothing has been lost. It means a new version
of the code was deployed without the setup file being run afterwards, so it is
looking for a column the database has not been given yet. Re-run the file (see
below) and reload the page.

## If every sign-in page shows "This page couldn't load"

The home page works but `/volunteer`, `/volunteer/login` and `/admin` all show
a server error. This was a real bug, fixed on 28 August 2026: signing in built
the knowledge base, and the knowledge base refuses to start in production
without proper embeddings — so a setting that should only have affected the
volunteer sidebar took down every page behind a login.

Redeploying picks up the fix. If you also want the sidebar working without
paying for a Voyage account, add this in Vercel under **Settings →
Environment Variables**, tick all three environments, and redeploy:

- **Key**: `NEXUS_ALLOW_HASHING_EMBEDDINGS`
- **Value**: `true`

The sidebar will then suggest verses and discussion points, but its
apologetics lookups match on shared words rather than meaning, so treat what
it cites with suspicion. For real conversations, set
`NEXUS_EMBEDDING_PROVIDER` to `voyage` and add a `VOYAGE_API_KEY` instead.

## Re-run the setup file

Migration 0007 is the seeker's chosen name, so the volunteer queue will show
people rather than languages once you have run it.


New versions sometimes add columns to the database. Nexus will show errors on
the pages that use them until you do this.

Open `docs/setup.sql`, copy all of it, paste it into Neon's **SQL Editor**, and
click **Run** — exactly as in Part 1. It is safe to run on a database that
already has conversations in it: it only adds what is missing and leaves
everything else alone.

## Check the review queue still opens

Sign in at `/admin` and make sure the page loads. If it shows an error
mentioning a column, the step above has not been done yet.

---

# Being told when somebody is in danger

Nexus watches conversations for signs that someone may be about to hurt
themselves. When it sees one, three things happen straight away: the person
is shown emergency numbers for their own country in their own language, the
volunteer is told, and the conversation is held for review.

The fourth thing — telling one of *your* people, immediately — only happens if
you set this up.

## Set up the alert

1. In **Microsoft Teams**, open the channel your leaders actually watch. Click
   the **⋯** beside the channel name → **Workflows** → choose **"Post to a
   channel when a webhook request is received"**. Follow it through and copy
   the web address it gives you at the end.

   In **Slack** instead: go to `api.slack.com/apps`, create an app for your
   workspace, turn on **Incoming Webhooks**, add one to a channel, and copy the
   address.

2. In Vercel: **Settings → Environment Variables → Add New**.
   - **Key**: `NEXUS_ALERT_WEBHOOK_URL`
   - **Value**: the address you copied
   - Tick all three environments, then **Save**.

3. Redeploy (**Deployments → ⋯ on the newest → Redeploy**).

## What gets posted

A short line saying a conversation was escalated, and a link to open it. It
never contains anything the person said. Those words stay encrypted in the
database, behind your administrator login, where they belong — a Teams channel
is readable by everyone in it and is outside every protection Nexus provides.

## If you do not set this up

That is a supported way to run Nexus, and nothing breaks. What changes is what
the volunteer is told: instead of "an administrator has been alerted", they are
told plainly that nobody has been paged and that right now they are the person
here. That is deliberate. Software should not tell someone in the worst moment
of their week that help is coming when it is not.

**Decide who is on the other end of this before you switch it on.** An alert
firing into a channel nobody is watching at 3am is worse than no alert, because
it feels like a plan.

---

# Letting volunteers practise

New volunteers can rehearse before they ever meet a real person. Sign in as a
volunteer and click **Practice**.

There are nine scenarios and they are meant to be hard: a mother furious about
her son's death, someone who left the church and knows the arguments better
than most pastors, somebody looking for a fight, a woman told her illness was
her own lack of faith, a man asking for money. Eight of the nine are written in
a language the volunteer will not read, because that is what this work is
actually like.

Nothing about a practice session is real. It never appears in the queue, no
real person is waiting, nothing is flagged for you to review, and **nobody is
alerted** — including in the one scenario that reaches somebody talking about
ending their life. That scenario is there on purpose, so the first time a
volunteer meets it is not the first time it is real. It is marked clearly, and
they can stop at any point.

When they finish, they get written feedback on how it went: what they did well,
what to work on, anything they said that would have hurt a real person, and a
plain reading of whether they look ready. Only they see it. Nexus does not keep
it.

**This costs money.** Every practice message is an AI request, like a real
conversation. A session is perhaps a dozen of them plus the feedback at the
end. It is worth it — but it is not free, so it is worth knowing that a
volunteer who works through all nine scenarios costs about as much as a busy
afternoon of real conversations.

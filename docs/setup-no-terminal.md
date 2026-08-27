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

**You forgot the volunteer password.**
There is no password reset yet. In Neon's SQL Editor, run
`DELETE FROM volunteers;` then repeat Part 2 — the setup page reopens once no
volunteers exist.

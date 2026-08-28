import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import { asSeekerId, type ModerationVerdict } from "@nexus/core";
import { EnvelopeCrypto, LocalKeyManagement } from "@nexus/crypto";
import type { NexusDatabase } from "../client.js";
import { createTestDatabase, testDatabaseUrl, type TestDatabase } from "../testing.js";
import { DrizzleAdminRepository } from "./admins.js";
import { DrizzleConversationRepository } from "./conversations.js";
import { DrizzleFlagRepository } from "./flags.js";
import { DrizzleMessageRepository } from "./messages.js";
import { DrizzleVolunteerRepository } from "./volunteers.js";
import { PostgresRateLimiter } from "./rate-limits.js";

/**
 * The repositories, against a real Postgres.
 *
 * Every other suite in this repo runs against fakes, which is fast and proves
 * nothing about the SQL. That gap is not theoretical: a `create({ approved:
 * true })` flag was accepted by the signature and silently dropped by the
 * INSERT, and 179 passing tests said nothing because none of them ever
 * executed a statement.
 *
 * Set TEST_DATABASE_URL to run these. See docs/testing.md.
 */
const url = testDatabaseUrl();
const describeIfDb = url ? describe : describe.skip;

if (!url) {
  // Say so loudly. A silently empty suite is how the gap persisted.
  console.warn(
    "\n  [skipped] Repository integration tests need TEST_DATABASE_URL.\n" +
      "            See docs/testing.md to run them locally.\n",
  );
}

describeIfDb("repositories against real Postgres", () => {
  let handle: TestDatabase;
  let db: NexusDatabase;
  let crypto: EnvelopeCrypto;

  beforeAll(async () => {
    handle = createTestDatabase(url!);
    db = handle.db;
    // The same file operators paste into Neon, so the tests exercise the
    // schema that actually ships rather than a parallel definition.
    const setup = readFileSync(
      new URL("../../../../docs/setup.sql", import.meta.url),
      "utf8",
    );
    await db.execute(sql.raw(setup));
    crypto = new EnvelopeCrypto(new LocalKeyManagement(randomBytes(32)));
  }, 60_000);

  afterAll(async () => {
    await handle?.close();
  });

  beforeEach(async () => {
    await db.execute(
      sql.raw(
        `truncate conversations, volunteers, admins, audit_log, rate_limits
         restart identity cascade`,
      ),
    );
  });

  const conversations = () => new DrizzleConversationRepository(db, crypto);
  const messages = () => new DrizzleMessageRepository(db, crypto);
  const volunteers = () => new DrizzleVolunteerRepository(db);

  async function newConversation(retainUntil: Date | null = null) {
    return conversations().create({
      seekerId: asSeekerId("skr_test"),
      seekerLanguage: "fa",
      modality: "text",
      retainUntil,
    });
  }

  async function newVolunteer(overrides: { approved?: boolean } = {}) {
    return volunteers().create({
      displayName: "Ana",
      email: `ana-${randomBytes(4).toString("hex")}@example.org`,
      passwordHash: "scrypt$1$1$1$aaaa$bbbb",
      languages: ["en"],
      ...overrides,
    });
  }

  describe("volunteers", () => {
    it("honours the approved flag on create", async () => {
      // THE regression. The signature accepted this and the INSERT ignored it,
      // so setup reported success and nobody could sign in.
      const approved = await newVolunteer({ approved: true });
      expect(approved.approvedAt).not.toBeNull();

      const pending = await newVolunteer({ approved: false });
      expect(pending.approvedAt).toBeNull();
    });

    it("defaults to unapproved when the flag is absent", async () => {
      expect((await newVolunteer()).approvedAt).toBeNull();
    });

    it("stores the application note for the approver to read", async () => {
      const applied = await volunteers().create({
        displayName: "Ben",
        email: "ben@example.org",
        passwordHash: "x",
        languages: ["en", "es"],
        applicationNote: "I have led a small group for six years.",
      });
      const found = await volunteers().findById(applied.id);
      expect(found?.applicationNote).toContain("six years");
      expect(found?.languages).toEqual(["en", "es"]);
    });

    it("lowercases the email so sign-in matches whatever they type", async () => {
      await volunteers().create({
        displayName: "Cara",
        email: "Cara.Smith@Example.ORG",
        passwordHash: "x",
        languages: ["en"],
      });
      expect(await volunteers().findByEmail("cara.smith@example.org")).not.toBeNull();
      expect(await volunteers().findByEmail("CARA.SMITH@EXAMPLE.ORG")).not.toBeNull();
    });

    it("only offers volunteers who are approved, unsuspended and available", async () => {
      const repo = volunteers();
      const ready = await newVolunteer({ approved: true });
      await repo.setStatus(ready.id, "available");

      const unapproved = await newVolunteer({ approved: false });
      await repo.setStatus(unapproved.id, "available");

      const suspended = await newVolunteer({ approved: true });
      await repo.setStatus(suspended.id, "available");
      await repo.setSuspended(suspended.id, true);

      const available = await repo.findAvailable();
      expect(available.map((v) => v.id)).toEqual([ready.id]);
    });

    it("stops offering a volunteer already at their concurrency cap", async () => {
      const repo = volunteers();
      const volunteer = await newVolunteer({ approved: true });
      await repo.setStatus(volunteer.id, "available");
      expect(await repo.findAvailable()).toHaveLength(1);

      // maxConcurrentConversations defaults to 1, so one active conversation
      // must take them out of the pool. This is a correlated subquery that no
      // fake ever exercised.
      const conversation = await newConversation();
      await conversations().claim(conversation.id, volunteer.id, "en");

      expect(await repo.findAvailable()).toHaveLength(0);
    });

    it("takes a suspended volunteer offline in the same statement", async () => {
      const repo = volunteers();
      const volunteer = await newVolunteer({ approved: true });
      await repo.setStatus(volunteer.id, "available");

      await repo.setSuspended(volunteer.id, true);

      expect((await repo.findById(volunteer.id))?.status).toBe("offline");
    });
  });

  describe("the seeker's chosen name", () => {
    it("round-trips through encryption", async () => {
      const created = await conversations().create({
        seekerId: asSeekerId("skr_named"),
        seekerLanguage: "fa",
        modality: "text",
        retainUntil: null,
        seekerName: "Sara",
      });

      expect(created.seekerName).toBe("Sara");
      expect((await conversations().findById(created.id))?.seekerName).toBe("Sara");
    });

    // The whole reason it is encrypted. A name is the single most identifying
    // thing a seeker gives us, and one sitting in plaintext beside an
    // encrypted transcript would undo the point of encrypting the transcript.
    it("is never stored in the clear", async () => {
      const created = await conversations().create({
        seekerId: asSeekerId("skr_named"),
        seekerLanguage: "fa",
        modality: "text",
        retainUntil: null,
        seekerName: "Zahra-Unique-Handle",
      });

      const raw = await db.execute(
        sql`select * from conversations where id = ${created.id}`,
      );
      expect(JSON.stringify(raw.rows ?? raw)).not.toContain("Zahra-Unique-Handle");
    });

    it("is null when nobody said", async () => {
      const created = await newConversation();
      expect(created.seekerName).toBeNull();
      expect((await conversations().findById(created.id))?.seekerName).toBeNull();
    });

    it("reaches the volunteer queue", async () => {
      await conversations().create({
        seekerId: asSeekerId("skr_named"),
        seekerLanguage: "es",
        modality: "text",
        retainUntil: null,
        seekerName: "Marisol",
      });

      const waiting = await conversations().findWaiting(10);
      expect(waiting.map((c) => c.seekerName)).toContain("Marisol");
    });

    it("survives being claimed", async () => {
      const created = await conversations().create({
        seekerId: asSeekerId("skr_named"),
        seekerLanguage: "es",
        modality: "text",
        retainUntil: null,
        seekerName: "Marisol",
      });
      const helper = await newVolunteer({ approved: true });

      const claimed = await conversations().claim(created.id, helper.id, "en");
      expect(claimed?.seekerName).toBe("Marisol");
    });
  });

  describe("practice sessions", () => {
    // The one thing that must never happen: a volunteer looking for someone
    // who needs help is handed somebody's rehearsal. Practice conversations
    // are born matched so they cannot reach the waiting query anyway, and the
    // query filters them out as well — this proves both.
    it("never appear in the waiting queue", async () => {
      const helper = await newVolunteer({ approved: true });
      await conversations().createPractice({
        volunteerId: helper.id,
        volunteerLanguage: "en",
        seekerLanguage: "es",
        scenario: "grief-mother",
        retainUntil: new Date(Date.now() + 14 * 86_400_000),
      });

      expect(await conversations().findWaiting(10)).toHaveLength(0);
    });

    it("open already matched, so there is nothing to claim", async () => {
      const helper = await newVolunteer({ approved: true });
      const session = await conversations().createPractice({
        volunteerId: helper.id,
        volunteerLanguage: "en",
        seekerLanguage: "fa",
        scenario: "hidden-convert",
        retainUntil: new Date(Date.now() + 14 * 86_400_000),
      });

      expect(session.status).toBe("active");
      expect(session.volunteerId).toBe(helper.id);
      expect(session.matchedAt).not.toBeNull();
      expect(session.practiceScenario).toBe("hidden-convert");
      expect(session.translationRequired).toBe(true);
    });

    // Same envelope encryption as a real conversation. A volunteer's fumbling
    // first attempt at the self-harm scenario is not something to leave in
    // plaintext for the next administrator to read.
    it("encrypt their transcript like any other conversation", async () => {
      const helper = await newVolunteer({ approved: true });
      const session = await conversations().createPractice({
        volunteerId: helper.id,
        volunteerLanguage: "en",
        seekerLanguage: "es",
        scenario: "grief-mother",
        retainUntil: new Date(Date.now() + 14 * 86_400_000),
      });

      await messages().append({
        conversationId: session.id,
        authorRole: "volunteer",
        authorId: helper.id,
        originalLanguage: "en",
        renderings: [{ language: "en", text: "unique-practice-phrase", source: "original" }],
      });

      const raw = await db.execute(
        sql`select ciphertext from messages where conversation_id = ${session.id}`,
      );
      const stored = JSON.stringify(raw.rows ?? raw);
      expect(stored).not.toContain("unique-practice-phrase");
    });

    it("skips translation when both sides share a language", async () => {
      const helper = await newVolunteer({ approved: true });
      const session = await conversations().createPractice({
        volunteerId: helper.id,
        volunteerLanguage: "en",
        seekerLanguage: "en",
        scenario: "deconstructing",
        retainUntil: new Date(Date.now() + 14 * 86_400_000),
      });

      expect(session.translationRequired).toBe(false);
    });
  });

  describe("coverage", () => {
    it("reports nobody on when the roster is empty", async () => {
      expect(await volunteers().coverage()).toEqual({
        state: "closed",
        freeNow: 0,
        onlineNow: 0,
      });
    });

    // Unapproved and suspended people are not coverage. Counting them would
    // make the front door promise someone who cannot be matched.
    it("ignores volunteers who could not be matched anyway", async () => {
      const pending = await newVolunteer({ approved: false });
      await volunteers().setStatus(pending.id, "available");

      const suspended = await newVolunteer({ approved: true });
      await volunteers().setStatus(suspended.id, "available");
      await volunteers().setSuspended(suspended.id, true);

      expect((await volunteers().coverage()).state).toBe("closed");
    });

    it("is open when an approved volunteer is available", async () => {
      const helper = await newVolunteer({ approved: true });
      await volunteers().setStatus(helper.id, "available");

      expect(await volunteers().coverage()).toMatchObject({
        state: "open",
        freeNow: 1,
        onlineNow: 1,
      });
    });

    it("is busy when everyone on is mid-conversation", async () => {
      const helper = await newVolunteer({ approved: true });
      await volunteers().setStatus(helper.id, "in_conversation");

      expect(await volunteers().coverage()).toMatchObject({
        state: "busy",
        freeNow: 0,
        onlineNow: 1,
      });
    });

    // The concurrency cap is part of "free", and it is enforced in SQL
    // against live conversation rows, so only a real database exercises it.
    it("is busy when the only volunteer on is at their cap", async () => {
      const helper = await newVolunteer({ approved: true });
      await volunteers().setStatus(helper.id, "available");

      const conversation = await newConversation();
      await conversations().claim(conversation.id, helper.id, "en");

      expect(await volunteers().coverage()).toMatchObject({
        state: "busy",
        freeNow: 0,
        onlineNow: 1,
      });
    });

    it("counts an away volunteer as neither free nor online", async () => {
      const helper = await newVolunteer({ approved: true });
      await volunteers().setStatus(helper.id, "away");

      expect(await volunteers().coverage()).toEqual({
        state: "closed",
        freeNow: 0,
        onlineNow: 0,
      });
    });
  });

  describe("conversations", () => {
    it("lets exactly one of two concurrent claims win", async () => {
      const conversation = await newConversation();
      const a = await newVolunteer({ approved: true });
      const b = await newVolunteer({ approved: true });

      // Real concurrency against a real database — the conditional UPDATE is
      // the entire concurrency story and had never been executed.
      const [first, second] = await Promise.all([
        conversations().claim(conversation.id, a.id, "en"),
        conversations().claim(conversation.id, b.id, "es"),
      ]);

      expect([first, second].filter(Boolean)).toHaveLength(1);
    });

    // Set-once is enforced by `is null` in the UPDATE's predicate, so it is
    // only real against a real database. The timestamp has to keep meaning
    // "when we first knew" — a crisis card that quietly resets its clock on
    // every later review is a lie about when someone first said something.
    it("keeps the first crisis timestamp across repeated escalations", async () => {
      const conversation = await newConversation();
      const first = new Date("2026-01-01T00:00:00Z");

      await conversations().markCrisis(conversation.id, first);
      await conversations().markCrisis(conversation.id, new Date("2026-06-01T00:00:00Z"));

      const stored = await conversations().findById(conversation.id);
      expect(stored?.crisisRaisedAt?.toISOString()).toBe(first.toISOString());
    });

    it("leaves crisis unset on a conversation that never escalated", async () => {
      const conversation = await newConversation();
      expect((await conversations().findById(conversation.id))?.crisisRaisedAt).toBeNull();
    });

    // Two escalations landing at once must not race into two different
    // timestamps, which is the same conditional-update story as claiming.
    it("survives two escalations arriving together", async () => {
      const conversation = await newConversation();
      const a = new Date("2026-02-01T00:00:00Z");
      const b = new Date("2026-03-01T00:00:00Z");

      await Promise.all([
        conversations().markCrisis(conversation.id, a),
        conversations().markCrisis(conversation.id, b),
      ]);

      const stored = await conversations().findById(conversation.id);
      expect([a.toISOString(), b.toISOString()]).toContain(
        stored?.crisisRaisedAt?.toISOString(),
      );
    });

    it("computes whether translation is needed from the two languages", async () => {
      const shared = await conversations().create({
        seekerId: asSeekerId("skr_en"),
        seekerLanguage: "en",
        modality: "text",
        retainUntil: null,
      });
      const volunteer = await newVolunteer({ approved: true });
      const claimed = await conversations().claim(shared.id, volunteer.id, "en-GB");

      // Regional variants are the same language.
      expect(claimed?.translationRequired).toBe(false);
    });

    it("returns waiting conversations oldest first", async () => {
      const first = await newConversation();
      await new Promise((r) => setTimeout(r, 15));
      const second = await newConversation();

      const waiting = await conversations().findWaiting(10);
      expect(waiting.map((c) => c.id)).toEqual([first.id, second.id]);
    });
  });

  describe("messages", () => {
    it("round-trips renderings through real encryption and SQL", async () => {
      const conversation = await newConversation();
      const stored = await messages().append({
        conversationId: conversation.id,
        authorRole: "seeker",
        authorId: null,
        originalLanguage: "fa",
        renderings: [
          { language: "fa", text: "آیا خدا صدای من را می‌شنود؟", source: "original" },
          { language: "en", text: "Does God hear me?", source: "machine" },
        ],
      });

      const [read] = await messages().listForConversation(conversation.id);
      expect(read?.renderings).toHaveLength(2);
      expect(read?.renderings[0]?.text).toBe("آیا خدا صدای من را می‌شنود؟");
      expect(read?.id).toBe(stored.id);
    });

    it("writes ciphertext, never readable text", async () => {
      const conversation = await newConversation();
      await messages().append({
        conversationId: conversation.id,
        authorRole: "seeker",
        authorId: null,
        originalLanguage: "en",
        renderings: [
          { language: "en", text: "a very distinctive sentence", source: "original" },
        ],
      });

      // Read the raw column. The point of the whole crypto layer is that this
      // is impossible to read, and only a real query can prove it.
      const raw = await db.execute(sql.raw("select ciphertext from messages"));
      const rows = (raw as unknown as { rows?: { ciphertext: string }[] }).rows ?? [];
      const blob = JSON.stringify(rows);
      expect(blob).not.toContain("distinctive");
      expect(blob.length).toBeGreaterThan(0);
    });

    it("replaces rather than duplicates when backfilling a rendering", async () => {
      const conversation = await newConversation();
      const message = await messages().append({
        conversationId: conversation.id,
        authorRole: "seeker",
        authorId: null,
        originalLanguage: "fa",
        renderings: [{ language: "fa", text: "سلام", source: "original" }],
      });

      await messages().addRendering(message.id, {
        language: "en",
        text: "Hello",
        source: "machine",
      });
      await messages().addRendering(message.id, {
        language: "en",
        text: "Hi there",
        source: "machine",
      });

      const [read] = await messages().listForConversation(conversation.id);
      expect(read?.renderings).toHaveLength(2);
      expect(read?.renderings.find((r) => r.language === "en")?.text).toBe("Hi there");
    });
  });

  describe("retention", () => {
    const past = () => new Date(Date.now() - 86_400_000);

    async function endedAndExpired() {
      const conversation = await newConversation(past());
      await conversations().end(conversation.id, "ended");
      return conversation;
    }

    it("finds an ended, expired conversation", async () => {
      const doomed = await endedAndExpired();
      const found = await conversations().findPurgeable(new Date(), 10);
      expect(found).toContain(doomed.id);
    });

    it("never offers a live conversation, whatever the date says", async () => {
      await newConversation(past());
      expect(await conversations().findPurgeable(new Date(), 10)).toHaveLength(0);
    });

    it("never offers a conversation carrying an unresolved flag", async () => {
      const conversation = await endedAndExpired();
      const flags = new DrizzleFlagRepository(db, crypto);
      const verdict: ModerationVerdict = {
        category: "off_mission",
        severity: "low",
        subject: "unclear",
        rationale: "Drifted.",
        action: "flag_for_review",
        evidenceMessageIds: [],
        confidence: 0.5,
      };
      await flags.raise(conversation.id, verdict);

      // The `not exists` subquery. Never executed before this test.
      expect(await conversations().findPurgeable(new Date(), 10)).toHaveLength(0);
    });

    it("purges and cascades to the messages", async () => {
      const conversation = await endedAndExpired();
      await messages().append({
        conversationId: conversation.id,
        authorRole: "seeker",
        authorId: null,
        originalLanguage: "en",
        renderings: [{ language: "en", text: "hello", source: "original" }],
      });

      expect(await conversations().purge([conversation.id])).toBe(1);
      expect(await conversations().findById(conversation.id)).toBeNull();

      const left = await db.execute(sql.raw("select count(*)::int as n from messages"));
      const rows = (left as unknown as { rows?: { n: number }[] }).rows ?? [];
      expect(rows[0]?.n).toBe(0);
    });

    it("restores an ended conversation to ended, not to active", async () => {
      const conversation = await endedAndExpired();
      await conversations().markUnderReview(conversation.id);

      // A CASE expression in SQL that a fake cannot represent.
      await conversations().restoreRetention(
        conversation.id,
        new Date(Date.now() + 1000),
      );

      const after = await conversations().findById(conversation.id);
      expect(after?.status).toBe("ended");
      expect(after?.retainUntil).not.toBeNull();
    });

    it("restores a live conversation to active", async () => {
      const conversation = await newConversation(past());
      await conversations().markUnderReview(conversation.id);

      await conversations().restoreRetention(
        conversation.id,
        new Date(Date.now() + 1000),
      );

      expect((await conversations().findById(conversation.id))?.status).toBe("active");
    });
  });

  describe("flags", () => {
    it("encrypts the rationale and reads it back", async () => {
      const conversation = await newConversation();
      const flags = new DrizzleFlagRepository(db, crypto);
      const rationale = "The volunteer pressed for a decision three times.";

      const raised = await flags.raise(conversation.id, {
        category: "spiritual_coercion",
        severity: "high",
        subject: "volunteer",
        rationale,
        action: "flag_for_review",
        evidenceMessageIds: [],
        confidence: 0.9,
      });

      expect((await flags.findById(raised.id))?.verdict.rationale).toBe(rationale);

      // It quotes the transcript, so it is as sensitive as the transcript.
      const raw = await db.execute(
        sql.raw("select rationale_ciphertext from moderation_flags"),
      );
      expect(JSON.stringify(raw)).not.toContain("pressed for a decision");
    });
  });

  describe("admins", () => {
    it("creates and finds by lowercased email", async () => {
      const repo = new DrizzleAdminRepository(db);
      await repo.create({
        displayName: "Root",
        email: "Root@Example.ORG",
        passwordHash: "x",
      });
      expect(await repo.findByEmail("root@example.org")).not.toBeNull();
      expect(await repo.count()).toBe(1);
    });
  });

  describe("rate limiter", () => {
    it("counts within a window and blocks past the limit", async () => {
      const limiter = new PostgresRateLimiter(db, "test-secret");
      const rule = { scope: "test", limit: 2, windowSeconds: 60 };

      expect((await limiter.check(rule, "1.2.3.4")).allowed).toBe(true);
      expect((await limiter.check(rule, "1.2.3.4")).allowed).toBe(true);
      expect((await limiter.check(rule, "1.2.3.4")).allowed).toBe(false);
      // A different caller is unaffected.
      expect((await limiter.check(rule, "5.6.7.8")).allowed).toBe(true);
    });

    it("counts correctly under concurrency", async () => {
      const limiter = new PostgresRateLimiter(db, "test-secret");
      const rule = { scope: "burst", limit: 100, windowSeconds: 60 };

      // The upsert must not lose increments to a race, or the limit is a
      // suggestion. Ten parallel checks must produce ten distinct counts.
      const results = await Promise.all(
        Array.from({ length: 10 }, () => limiter.check(rule, "same-caller")),
      );
      const remaining = results.map((r) => r.remaining).sort((a, b) => a - b);
      expect(new Set(remaining).size).toBe(10);
    });

    it("stores no recoverable address", async () => {
      const limiter = new PostgresRateLimiter(db, "test-secret");
      await limiter.check({ scope: "s", limit: 5, windowSeconds: 60 }, "198.51.100.9");

      const raw = await db.execute(sql.raw("select key from rate_limits"));
      expect(JSON.stringify(raw)).not.toContain("198.51.100.9");
    });

    it("prunes windows that no longer matter", async () => {
      const limiter = new PostgresRateLimiter(db, "test-secret");
      await limiter.check({ scope: "s", limit: 5, windowSeconds: 60 }, "a");

      expect(await limiter.prune(new Date(Date.now() - 86_400_000))).toBe(0);
      expect(await limiter.prune(new Date(Date.now() + 86_400_000))).toBe(1);
    });
  });
});

/**
 * Creates and approves a volunteer account.
 *
 * This exists because there is no volunteer provisioning UI yet, and without
 * one there is no way to sign in to the volunteer side at all. It approves
 * the account immediately, which the real flow will not do — vetting who
 * speaks to seekers is the safety model, and an admin approval screen is on
 * the wave-two list.
 *
 *   pnpm seed:volunteer --email ana@example.org --name "Ana" --languages en,es
 *
 * Omit --password and one is generated and printed.
 */
import { parseArgs } from "node:util";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { hashPassword } from "@nexus/auth";
import { createDatabase } from "./client.js";
import { volunteers } from "./schema.js";

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      name: { type: "string" },
      languages: { type: "string", default: "en" },
      password: { type: "string" },
    },
    allowPositionals: false,
  });

  if (!values.email || !values.name) {
    console.error(
      "Usage: pnpm seed:volunteer --email <email> --name <name> " +
        "[--languages en,es] [--password <password>]",
    );
    process.exit(1);
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Copy .env.example to .env.local first.");
    process.exit(1);
  }

  const email = values.email.toLowerCase();
  const languages = values.languages
    .split(",")
    .map((l) => l.trim())
    .filter(Boolean);

  // 24 bytes of base64url clears the 12-character policy comfortably.
  const password = values.password ?? randomBytes(18).toString("base64url");
  const generated = values.password === undefined;

  const db = createDatabase(url);

  const existing = await db
    .select({ id: volunteers.id })
    .from(volunteers)
    .where(eq(volunteers.email, email))
    .limit(1);

  if (existing.length > 0) {
    console.error(`A volunteer with the email ${email} already exists.`);
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);

  const rows = await db
    .insert(volunteers)
    .values({
      displayName: values.name,
      email,
      passwordHash,
      languages,
      status: "offline",
      // Approved immediately. The real flow requires an admin; see above.
      approvedAt: new Date(),
    })
    .returning({ id: volunteers.id });

  console.log(`\nVolunteer created and approved.`);
  console.log(`  id         ${rows[0]?.id}`);
  console.log(`  email      ${email}`);
  console.log(`  languages  ${languages.join(", ")}`);
  if (generated) {
    console.log(`  password   ${password}`);
    console.log(`\nThis password is shown once. Save it now.`);
  }
  console.log(`\nSign in at /volunteer/login\n`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

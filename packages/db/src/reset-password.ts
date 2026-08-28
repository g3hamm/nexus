/**
 * Sets a password directly, for the cases the UI cannot reach.
 *
 *   pnpm reset:password --email you@example.org --role admin
 *
 * Two situations need this. An administrator who has forgotten their password
 * has nobody above them to issue a reset — and an administrator locked out by
 * a lost second factor with no recovery codes left is in the same position.
 * Both are recoverable here, and the bar is database credentials, which is the
 * right bar for something that hands over access to every transcript.
 *
 * `--clear-mfa` also removes the second factor, for that second case.
 */
import { parseArgs } from "node:util";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { hashPassword } from "@nexus/auth";
import { createDatabase } from "./client.js";
import { admins, volunteers } from "./schema.js";

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      role: { type: "string", default: "admin" },
      password: { type: "string" },
      "clear-mfa": { type: "boolean", default: false },
    },
    allowPositionals: false,
  });

  if (!values.email || (values.role !== "admin" && values.role !== "volunteer")) {
    console.error(
      "Usage: pnpm reset:password --email <email> --role admin|volunteer " +
        "[--password <password>] [--clear-mfa]",
    );
    process.exit(1);
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const email = values.email.toLowerCase();
  const password = values.password ?? randomBytes(18).toString("base64url");
  const generated = values.password === undefined;

  const db = createDatabase(url);
  const passwordHash = await hashPassword(password);

  if (values.role === "admin") {
    const updated = await db
      .update(admins)
      .set({
        passwordHash,
        // Clearing the seed and the codes together — a stale secret left
        // behind would silently come back into force on re-enrolment.
        ...(values["clear-mfa"]
          ? { totpSecret: null, totpEnabledAt: null, recoveryCodeHashes: [] }
          : {}),
      })
      .where(eq(admins.email, email))
      .returning({ id: admins.id });

    if (updated.length === 0) {
      console.error(`No administrator with the email ${email}.`);
      process.exit(1);
    }
    if (values["clear-mfa"]) console.log("Two-factor authentication removed.");
  } else {
    const updated = await db
      .update(volunteers)
      .set({ passwordHash, resetCodeHash: null, resetExpiresAt: null })
      .where(eq(volunteers.email, email))
      .returning({ id: volunteers.id });

    if (updated.length === 0) {
      console.error(`No volunteer with the email ${email}.`);
      process.exit(1);
    }
  }

  console.log(`\nPassword set for ${email} (${values.role}).`);
  if (generated) {
    console.log(`  password  ${password}`);
    console.log(`\nShown once. Save it now.`);
  }
  console.log("");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

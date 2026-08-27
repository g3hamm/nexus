/**
 * Creates an administrator account.
 *
 *   pnpm seed:admin --email you@example.org --name "Your Name"
 *
 * An admin can read every transcript on the platform, so there is deliberately
 * no self-service route to becoming one. This script needs database
 * credentials, which is the intended bar.
 *
 * Omit --password and one is generated and printed once.
 */
import { parseArgs } from "node:util";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { hashPassword } from "@nexus/auth";
import { createDatabase } from "./client.js";
import { admins } from "./schema.js";

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      name: { type: "string" },
      password: { type: "string" },
    },
    allowPositionals: false,
  });

  if (!values.email || !values.name) {
    console.error(
      "Usage: pnpm seed:admin --email <email> --name <name> [--password <password>]",
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

  const existing = await db
    .select({ id: admins.id })
    .from(admins)
    .where(eq(admins.email, email))
    .limit(1);

  if (existing.length > 0) {
    console.error(`An administrator with the email ${email} already exists.`);
    process.exit(1);
  }

  const rows = await db
    .insert(admins)
    .values({
      displayName: values.name,
      email,
      passwordHash: await hashPassword(password),
    })
    .returning({ id: admins.id });

  console.log(`\nAdministrator created.`);
  console.log(`  id     ${rows[0]?.id}`);
  console.log(`  email  ${email}`);
  if (generated) {
    console.log(`  password  ${password}`);
    console.log(`\nThis password is shown once. Save it now.`);
  }
  console.log(`\nSign in at /admin/login\n`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

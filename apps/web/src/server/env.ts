import { z } from "zod";

/**
 * Environment configuration, validated once at startup.
 *
 * Failing loudly here beats a `undefined` connection string surfacing as a
 * confusing runtime error three layers down, and it means a misconfigured
 * deploy fails at boot rather than on the first seeker's first message.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  NEXUS_KMS_PROVIDER: z.enum(["local", "aws"]).default("local"),
  NEXUS_MASTER_KEY: z.string().optional(),
  /** Trial deployments only. See docs/deploying.md. */
  NEXUS_ALLOW_INSECURE_LOCAL_KMS: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  AWS_KMS_KEY_ID: z.string().optional(),
  AWS_REGION: z.string().default("us-east-1"),

  NEXUS_LLM_PROVIDER: z.string().default("anthropic"),
  ANTHROPIC_API_KEY: z.string().optional(),

  NEXUS_EMBEDDING_PROVIDER: z.string().default("hashing"),
  VOYAGE_API_KEY: z.string().optional(),
  /**
   * Lets a trial deployment run without a Voyage account.
   *
   * The knowledge base still answers, just badly — retrieval matches on shared
   * words rather than meaning. Everything else in Nexus is unaffected.
   */
  NEXUS_ALLOW_HASHING_EMBEDDINGS: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),

  NEXUS_REALTIME_PROVIDER: z.string().default("livekit"),
  LIVEKIT_URL: z.string().optional(),
  LIVEKIT_API_KEY: z.string().optional(),
  LIVEKIT_API_SECRET: z.string().optional(),

  NEXUS_SESSION_SECRET: z
    .string()
    .min(32, "NEXUS_SESSION_SECRET must be at least 32 characters"),

  API_BIBLE_KEY: z.string().optional(),

  /**
   * Incoming webhook — a Teams channel, a Slack channel — for the one class
   * of event that cannot wait for someone to open the flag queue: a seeker
   * who may be about to hurt themselves.
   *
   * Optional, and unset is a real configuration rather than a mistake: a
   * small deployment where an admin watches the queue is legitimate, and
   * alerts fall back to the platform logs. What is not legitimate is the
   * code claiming an administrator was alerted when nothing was sent, which
   * is why the volunteer's wording depends on whether this is set.
   */
  NEXUS_ALERT_WEBHOOK_URL: z.string().optional(),

  /**
   * This deployment's public origin, used to put a clickable link in alerts.
   *
   * Vercel supplies its own, but only for production deploys, and a preview
   * URL in an alert is worse than no link at all.
   */
  NEXUS_PUBLIC_URL: z.string().optional(),

  /**
   * Unlocks /setup, which creates the first volunteer without a terminal.
   * Unset it once you have an account — the route is inert without it.
   */
  NEXUS_SETUP_TOKEN: z.string().min(8).optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Nexus is misconfigured:\n${problems}\n\n` +
        `Copy .env.example to .env.local and fill it in.`,
    );
  }

  cached = parsed.data;
  return cached;
}

export function isProduction(): boolean {
  return env().NODE_ENV === "production";
}

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

  NEXUS_REALTIME_PROVIDER: z.string().default("livekit"),
  LIVEKIT_URL: z.string().optional(),
  LIVEKIT_API_KEY: z.string().optional(),
  LIVEKIT_API_SECRET: z.string().optional(),

  NEXUS_SESSION_SECRET: z
    .string()
    .min(32, "NEXUS_SESSION_SECRET must be at least 32 characters"),

  API_BIBLE_KEY: z.string().optional(),
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

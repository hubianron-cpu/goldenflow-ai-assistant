import { z } from "zod";

const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional()
});

const serverEnvSchema = clientEnvSchema.extend({
  APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4.1-mini"),
  OPENAI_AGENT_TIMEOUT_MS: z.coerce.number().int().positive().default(20000),
  OPENAI_AGENT_MAX_RETRIES: z.coerce.number().int().min(0).max(2).default(1),
  AGENT_PROVIDER: z.enum(["local", "openai"]).default("local")
});

export type ClientStageEnvironment = z.infer<typeof clientEnvSchema> & {
  supabaseConfigured: boolean;
  isStaging: boolean;
};

export type ServerStageEnvironment = z.infer<typeof serverEnvSchema> & {
  errors: string[];
  safeToStart: boolean;
  supabaseConfigured: boolean;
  openaiConfigured: boolean;
  isStaging: boolean;
};

function hasProductionMarker(value: string | undefined) {
  return Boolean(value && /prod|production/i.test(value));
}

export function readClientStageEnvironment(source: Record<string, string | undefined> = process.env): ClientStageEnvironment {
  const parsed = clientEnvSchema.parse(source);
  return {
    ...parsed,
    supabaseConfigured: Boolean(parsed.NEXT_PUBLIC_SUPABASE_URL && parsed.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    isStaging: parsed.NEXT_PUBLIC_APP_ENV === "staging"
  };
}

export function readServerStageEnvironment(source: Record<string, string | undefined> = process.env): ServerStageEnvironment {
  const parsed = serverEnvSchema.safeParse(source);
  if (!parsed.success) {
    return {
      ...serverEnvSchema.parse({}),
      errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
      safeToStart: false,
      supabaseConfigured: false,
      openaiConfigured: false,
      isStaging: false
    };
  }

  const env = parsed.data;
  const errors: string[] = [];
  const supabaseConfigured = Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const openaiConfigured = Boolean(env.OPENAI_API_KEY);

  if (env.APP_ENV === "staging" && env.NEXT_PUBLIC_APP_ENV !== "staging") {
    errors.push("APP_ENV=staging requires NEXT_PUBLIC_APP_ENV=staging.");
  }
  if (env.APP_ENV === "staging" && hasProductionMarker(env.NEXT_PUBLIC_SUPABASE_URL)) {
    errors.push("Staging must not use a Supabase URL that appears to be production.");
  }
  if (env.APP_ENV === "staging" && !supabaseConfigured) {
    errors.push("Supabase staging credentials are required for real staging auth.");
  }
  if (env.AGENT_PROVIDER === "openai" && !openaiConfigured) {
    errors.push("AGENT_PROVIDER=openai requires OPENAI_API_KEY on the server.");
  }

  return {
    ...env,
    errors,
    safeToStart: errors.length === 0,
    supabaseConfigured,
    openaiConfigured,
    isStaging: env.APP_ENV === "staging"
  };
}

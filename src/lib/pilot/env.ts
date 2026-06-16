import { z } from "zod";

const envSchema = z.object({
  APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
  PILOT_BUSINESS_ID: z.string().optional(),
  WHATSAPP_PROVIDER: z.enum(["mock", "whatsapp_cloud"]).default("mock"),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),
  WHATSAPP_API_BASE_URL: z.string().url().default("https://graph.facebook.com/v20.0"),
  WHATSAPP_SENDING_ENABLED: z.enum(["true", "false"]).default("false"),
  GOLDENFLOW_CRM_API_BASE_URL: z.string().url().optional(),
  GOLDENFLOW_CRM_API_KEY: z.string().optional(),
  GOLDENFLOW_CRM_WEBHOOK_SECRET: z.string().optional(),
  GOLDENFLOW_CRM_INTEGRATION_ENABLED: z.enum(["true", "false"]).default("false"),
  GOLDENFLOW_CRM_TIMEOUT_MS: z.coerce.number().int().positive().default(5000)
});

export type PilotEnvironment = z.infer<typeof envSchema> & {
  errors: string[];
  safeToStart: boolean;
};

export function readPilotEnvironment(source: Record<string, string | undefined> = process.env): PilotEnvironment {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    return {
      ...envSchema.parse({}),
      errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
      safeToStart: false
    };
  }

  const errors: string[] = [];
  const env = parsed.data;
  if (env.APP_ENV === "production" && env.WHATSAPP_PROVIDER === "whatsapp_cloud") {
    for (const key of ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_VERIFY_TOKEN", "WHATSAPP_APP_SECRET"] as const) {
      if (!env[key]) errors.push(`${key} is required for production WhatsApp Cloud API.`);
    }
  }
  if (env.APP_ENV === "production" && env.WHATSAPP_SENDING_ENABLED === "true" && env.WHATSAPP_PROVIDER !== "whatsapp_cloud") {
    errors.push("Production sending requires the official WhatsApp Cloud API provider.");
  }
  if (env.APP_ENV !== "production" && env.GOLDENFLOW_CRM_API_BASE_URL?.includes("production")) {
    errors.push("Development/Staging must not point at a production CRM API URL.");
  }

  return {
    ...env,
    errors,
    safeToStart: errors.length === 0
  };
}

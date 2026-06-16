import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { readServerStageEnvironment } from "../src/lib/staging/env";

type AuditRow = {
  check: string;
  status: "passed" | "blocked_missing_credentials" | "failed";
  details: string;
};

const root = process.cwd();

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((item) => {
    const path = join(dir, item);
    const stat = statSync(path);
    if (stat.isDirectory()) return walk(path);
    return [path];
  });
}

const srcFiles = walk(join(root, "src")).filter((file) => /\.(ts|tsx)$/.test(file));
const supabaseFiles = readdirSync(join(root, "supabase")).filter((file) => file.endsWith(".sql")).sort();
const clientFiles = srcFiles.filter((file) => readFileSync(file, "utf8").startsWith("\"use client\""));
const clientSecretMatches = clientFiles.flatMap((file) => {
  const text = readFileSync(file, "utf8");
  return ["SUPABASE_SERVICE_ROLE_KEY", "OPENAI_API_KEY", "PILOT_ADMIN_TOKEN"].filter((secret) => text.includes(secret)).map((secret) => `${file}:${secret}`);
});
const schemaText = supabaseFiles.map((file) => readFileSync(join(root, "supabase", file), "utf8")).join("\n");
const env = readServerStageEnvironment();

const rows: AuditRow[] = [
  {
    check: "Supabase staging credentials",
    status: env.supabaseConfigured ? "passed" : "blocked_missing_credentials",
    details: env.supabaseConfigured ? "NEXT_PUBLIC_SUPABASE_URL and anon key are configured." : "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY."
  },
  {
    check: "OpenAI server credentials",
    status: env.openaiConfigured ? "passed" : "blocked_missing_credentials",
    details: env.openaiConfigured ? "OPENAI_API_KEY is present server-side." : "Missing OPENAI_API_KEY; real OpenAI evaluation is blocked."
  },
  {
    check: "No client secret identifiers",
    status: clientSecretMatches.length ? "failed" : "passed",
    details: clientSecretMatches.length ? clientSecretMatches.join(", ") : "No service role, OpenAI key, or pilot admin token identifiers found in client components."
  },
  {
    check: "Migration files discovered",
    status: supabaseFiles.includes("004_phase4_staging_auth.sql") ? "passed" : "failed",
    details: supabaseFiles.join(", ")
  },
  {
    check: "RLS enabled in schema/migrations",
    status: schemaText.includes("enable row level security") && schemaText.includes("user_has_business") ? "passed" : "failed",
    details: "Checked SQL for RLS enablement and business membership helper."
  },
  {
    check: "Stage 4 safety env",
    status: env.safeToStart || env.errors.every((error) => error.includes("Supabase staging credentials")) ? "passed" : "failed",
    details: env.errors.length ? env.errors.join(" | ") : "No stage safety errors."
  }
];

console.table(rows);

if (rows.some((row) => row.status === "failed")) {
  process.exit(1);
}

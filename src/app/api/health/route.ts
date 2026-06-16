import { NextResponse } from "next/server";
import { readPilotEnvironment } from "@/lib/pilot/env";
import { getPilotState } from "@/lib/pilot/server-store";
import { getWhatsAppProvider } from "@/services/messaging/whatsapp";
import { goldenFlowCRMAdapter } from "@/services/crm/goldenflow";
import { readServerStageEnvironment } from "@/lib/staging/env";

export async function GET() {
  const env = readPilotEnvironment();
  const stageEnv = readServerStageEnvironment();
  const state = getPilotState();
  const whatsapp = await getWhatsAppProvider().healthCheck();
  const crm = await goldenFlowCRMAdapter.getBusinessConfiguration(state.business?.id ?? "unknown");
  return NextResponse.json({
    ok: env.safeToStart && stageEnv.safeToStart,
    environment: stageEnv.APP_ENV,
    publicEnvironment: stageEnv.NEXT_PUBLIC_APP_ENV,
    configuration: env.safeToStart && stageEnv.safeToStart ? "valid" : "invalid",
    configurationErrors: [...env.errors, ...stageEnv.errors],
    database: "mock_store_available",
    supabase: stageEnv.supabaseConfigured ? "configured" : "blocked_missing_credentials",
    authProvider: stageEnv.supabaseConfigured ? "supabase_auth" : "development_demo_fallback",
    aiProvider: stageEnv.AGENT_PROVIDER === "openai" ? (stageEnv.openaiConfigured ? "openai_responses" : "blocked_missing_openai_key") : "local_rules_v2",
    whatsappProvider: whatsapp.ok ? whatsapp.mode : "error",
    goldenFlowCRMAdapter: crm.mode,
    jobProcessor: "db_backed_contract_with_mock_dev_store",
    secretsExposed: false
  });
}

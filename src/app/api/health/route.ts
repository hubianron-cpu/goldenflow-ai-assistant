import { NextResponse } from "next/server";
import { readPilotEnvironment } from "@/lib/pilot/env";
import { getPilotState } from "@/lib/pilot/server-store";
import { getWhatsAppProvider } from "@/services/messaging/whatsapp";
import { goldenFlowCRMAdapter } from "@/services/crm/goldenflow";

export async function GET() {
  const env = readPilotEnvironment();
  const state = getPilotState();
  const whatsapp = await getWhatsAppProvider().healthCheck();
  const crm = await goldenFlowCRMAdapter.getBusinessConfiguration(state.business?.id ?? "unknown");
  return NextResponse.json({
    ok: env.safeToStart,
    environment: env.APP_ENV,
    configuration: env.safeToStart ? "valid" : "invalid",
    configurationErrors: env.errors,
    database: "mock_store_available",
    aiProvider: "local_rules_v2",
    whatsappProvider: whatsapp.ok ? whatsapp.mode : "error",
    goldenFlowCRMAdapter: crm.mode,
    jobProcessor: "db_backed_contract_with_mock_dev_store",
    secretsExposed: false
  });
}

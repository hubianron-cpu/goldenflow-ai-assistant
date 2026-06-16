import { readPilotEnvironment } from "@/lib/pilot/env";
import { WhatsAppCloudProvider } from "./cloud-provider";
import { MockWhatsAppProvider } from "./mock-provider";
import type { WhatsAppProvider } from "./types";

export function getWhatsAppProvider(): WhatsAppProvider {
  const env = readPilotEnvironment();
  return env.WHATSAPP_PROVIDER === "whatsapp_cloud" ? new WhatsAppCloudProvider() : new MockWhatsAppProvider();
}

export * from "./types";
export * from "./phone";

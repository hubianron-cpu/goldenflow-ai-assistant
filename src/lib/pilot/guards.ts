import type { Business, Conversation, Lead, NormalizedIncomingMessage, PilotSettings } from "@/lib/store/types";

export type GuardResult = {
  allowed: boolean;
  reason: string;
};

export function checkPilotCanReceive(settings: PilotSettings): GuardResult {
  if (!settings.pilotEnabled) return { allowed: false, reason: "pilot_enabled is false" };
  if (!settings.whatsappReceivingEnabled) return { allowed: false, reason: "whatsapp_receiving_enabled is false" };
  return { allowed: true, reason: "receiving allowed" };
}

export function checkPilotCanRunAgent(settings: PilotSettings, conversation: Conversation): GuardResult {
  if (!settings.pilotEnabled) return { allowed: false, reason: "pilot_enabled is false" };
  if (!settings.agentEnabled) return { allowed: false, reason: "agent_enabled is false" };
  if (settings.automationLevel === "off") return { allowed: false, reason: "automation_level is off" };
  if (!["active", "resumed"].includes(conversation.aiMode)) return { allowed: false, reason: `ai_mode is ${conversation.aiMode}` };
  if (conversation.processingLockExpiresAt && new Date(conversation.processingLockExpiresAt).getTime() > Date.now()) {
    return { allowed: false, reason: "conversation lock is active" };
  }
  return { allowed: true, reason: "agent allowed" };
}

export function checkPhoneAllowlist(settings: PilotSettings, allowlist: string[], normalizedPhone: string): GuardResult {
  if (!settings.phoneAllowlistEnabled) return { allowed: true, reason: "allowlist disabled" };
  if (allowlist.includes(normalizedPhone)) return { allowed: true, reason: "phone allowlisted" };
  return { allowed: false, reason: "phone is not allowlisted" };
}

export function checkMessageSupported(message: NormalizedIncomingMessage): GuardResult {
  if (message.isSupported) return { allowed: true, reason: "supported text message" };
  return { allowed: false, reason: `unsupported message type: ${message.messageType}` };
}

export function checkCanSend(input: { business: Business; lead: Lead; conversation: Conversation; latestMessageIds: string[]; draftSourceMessageIds: string[] }): GuardResult {
  const settings = input.business.pilotSettings;
  if (!settings.pilotEnabled) return { allowed: false, reason: "pilot_enabled is false" };
  if (!settings.whatsappSendingEnabled) return { allowed: false, reason: "whatsapp_sending_enabled is false" };
  if (settings.automationLevel === "off") return { allowed: false, reason: "automation_level is off" };
  if (input.lead.doNotContact) return { allowed: false, reason: "lead has do_not_contact" };
  if (!["active", "resumed"].includes(input.conversation.aiMode)) return { allowed: false, reason: `ai_mode is ${input.conversation.aiMode}` };
  const latest = input.latestMessageIds.join(",");
  const draftSource = input.draftSourceMessageIds.join(",");
  if (latest !== draftSource) return { allowed: false, reason: "draft is stale because new messages arrived" };
  return { allowed: true, reason: "send allowed" };
}

export function isOptOutText(text: string) {
  return /(תפסיק|תפסיקו|לא לשלוח|הסר|הסרה|stop|unsubscribe|do not contact)/i.test(text);
}

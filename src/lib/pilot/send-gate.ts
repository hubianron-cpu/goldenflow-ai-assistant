import type { Business, Conversation, Lead, OutboundDraft } from "@/lib/store/types";
import { checkCanSend } from "./guards";

export type SendGateResult = {
  allowed: boolean;
  reason: string;
  draftOnly: boolean;
};

export function evaluateSendGate(input: {
  business: Business;
  lead: Lead;
  conversation: Conversation;
  draft: OutboundDraft;
  latestMessageIds: string[];
}): SendGateResult {
  if (input.business.pilotSettings.automationLevel === "draft_only") {
    return { allowed: false, reason: "automation_level is draft_only; manual approval required", draftOnly: true };
  }
  const guard = checkCanSend({
    business: input.business,
    lead: input.lead,
    conversation: input.conversation,
    latestMessageIds: input.latestMessageIds,
    draftSourceMessageIds: input.draft.sourceMessageIds
  });
  return { allowed: guard.allowed, reason: guard.reason, draftOnly: false };
}

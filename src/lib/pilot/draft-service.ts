import type { AgentRun, Conversation, Lead, OutboundDraft } from "@/lib/store/types";

export function createOutboundDraft(input: {
  businessId: string;
  lead: Lead;
  conversation: Conversation;
  agentRun: AgentRun;
  sourceMessageIds: string[];
}): OutboundDraft {
  const now = new Date().toISOString();
  return {
    id: `draft_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    businessId: input.businessId,
    leadId: input.lead.id,
    conversationId: input.conversation.id,
    sourceMessageIds: input.sourceMessageIds,
    originalDraftMessage: input.agentRun.reply,
    draftMessage: input.agentRun.reply,
    status: "pending_approval",
    confidence: input.agentRun.output.lead_score,
    blockReason: input.agentRun.output.requires_human_takeover ? input.agentRun.output.takeover_reason : null,
    approvedBy: null,
    approvedAt: null,
    editedAt: null,
    createdAt: now,
    updatedAt: now
  };
}

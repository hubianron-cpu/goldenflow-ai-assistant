import type { AgentAction, AgentStructuredOutput, Conversation, Lead } from "@/lib/store/types";

export function recommendAction(input: {
  businessId: string;
  conversation: Conversation;
  lead: Lead;
  output: AgentStructuredOutput;
  now: string;
}): AgentAction {
  const priority = input.output.requires_human_takeover || input.output.lead_temperature === "hot" ? "high" : input.output.follow_up_needed ? "medium" : "low";
  const actionType = input.output.requires_human_takeover
    ? "owner_reply"
    : input.output.next_recommended_action === "prepare_booking"
      ? "prepare_booking"
      : input.output.follow_up_needed
        ? "schedule_follow_up"
        : input.output.next_recommended_action === "close_not_relevant"
          ? "mark_not_relevant"
          : "continue_ai_conversation";

  return {
    id: `action_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    businessId: input.businessId,
    actionType,
    reason: input.output.takeover_reason ?? input.output.follow_up_reason ?? input.output.internal_notes,
    priority,
    recommendedDueAt: input.output.follow_up_delay_minutes
      ? new Date(Date.now() + input.output.follow_up_delay_minutes * 60 * 1000).toISOString()
      : input.now,
    conversationId: input.conversation.id,
    leadId: input.lead.id,
    createdAt: input.now
  };
}

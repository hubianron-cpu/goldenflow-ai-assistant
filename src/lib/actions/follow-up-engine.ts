import type { AgentStructuredOutput, Conversation, FollowUpDraft, Lead } from "@/lib/store/types";

export function createFollowUpDraft(input: {
  businessId: string;
  conversation: Conversation;
  lead: Lead;
  output: AgentStructuredOutput;
  now: string;
  existingDrafts: FollowUpDraft[];
}): FollowUpDraft | null {
  if (!input.output.follow_up_needed || input.output.requires_human_takeover || input.conversation.structuredMemory.asked_to_stop) {
    return null;
  }

  const duplicate = input.existingDrafts.some(
    (draft) => draft.conversationId === input.conversation.id && ["draft", "recommended", "approved"].includes(draft.status)
  );
  if (duplicate) {
    return null;
  }

  const delay = input.output.follow_up_delay_minutes ?? 1440;
  return {
    id: `follow_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    businessId: input.businessId,
    leadId: input.lead.id,
    conversationId: input.conversation.id,
    status: "recommended",
    draftMessage: `היי ${input.lead.name}, רציתי לבדוק אם עדיין רלוונטי להתקדם עם ${input.conversation.summaryDetails.interestedService ?? "השיחה שלנו"}.`,
    reason: input.output.follow_up_reason ?? "הליד צריך תזכורת עדינה להמשך שיחה.",
    scheduledFor: new Date(Date.now() + delay * 60 * 1000).toISOString(),
    createdBy: "agent",
    createdAt: input.now,
    updatedAt: input.now
  };
}

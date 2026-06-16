import type { AgentStructuredOutput, ConversationState } from "@/lib/store/types";

const allowedTransitions: Record<ConversationState, ConversationState[]> = {
  new_lead: ["qualification", "waiting_for_owner", "closed_not_relevant"],
  qualification: ["warming_up", "objection_handling", "booking_ready", "follow_up_needed", "waiting_for_owner", "closed_not_relevant"],
  warming_up: ["qualification", "objection_handling", "booking_ready", "follow_up_needed", "waiting_for_owner", "closed_not_relevant"],
  objection_handling: ["warming_up", "booking_ready", "follow_up_needed", "waiting_for_owner", "closed_not_relevant"],
  booking_ready: ["waiting_for_owner", "booked", "follow_up_needed"],
  follow_up_needed: ["qualification", "warming_up", "waiting_for_owner", "closed_not_relevant"],
  waiting_for_user: ["qualification", "warming_up", "follow_up_needed", "waiting_for_owner", "closed_not_relevant"],
  waiting_for_owner: ["transferred_to_owner", "closed_by_owner", "qualification"],
  transferred_to_owner: ["closed_by_owner", "booked", "qualification"],
  booked: ["closed_by_owner"],
  closed_not_relevant: [],
  closed_by_owner: []
};

export function canTransition(previousState: ConversationState, newState: ConversationState) {
  return previousState === newState || allowedTransitions[previousState].includes(newState);
}

export function chooseSafeTransition(previousState: ConversationState, output: AgentStructuredOutput) {
  const requestedState = output.conversation_state;
  if (output.requires_human_takeover && previousState !== "transferred_to_owner") {
    return {
      state: requestedState === "booking_ready" ? "booking_ready" : "waiting_for_owner",
      reason: output.takeover_reason ?? "נדרשת בדיקת בעל העסק"
    } as const;
  }

  if (canTransition(previousState, requestedState)) {
    return {
      state: requestedState,
      reason: `מעבר מבוקר לפי intent: ${output.detected_intent}`
    } as const;
  }

  return {
    state: previousState,
    reason: `מעבר לא חוקי נחסם: ${previousState} -> ${requestedState}`
  } as const;
}

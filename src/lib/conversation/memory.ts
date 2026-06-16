import type { AgentStructuredOutput, StructuredMemory } from "@/lib/store/types";

export function createEmptyStructuredMemory(): StructuredMemory {
  return {
    asked_questions: [],
    answered_questions: [],
    objections: [],
    buying_signals: [],
    price_requested: false,
    wants_booking: false,
    requested_human: false,
    asked_to_stop: false
  };
}

export function updateMemory(memory: StructuredMemory, output: AgentStructuredOutput) {
  const next: StructuredMemory = {
    ...memory,
    ...output.collected_fields,
    objections: Array.from(new Set([...memory.objections, ...output.detected_objections])),
    buying_signals: Array.from(new Set([...memory.buying_signals, ...output.buying_signals])),
    price_requested: memory.price_requested || output.detected_intent === "price_request",
    wants_booking: memory.wants_booking || output.detected_intent === "booking_request",
    requested_human: memory.requested_human || output.detected_intent === "human_request",
    asked_to_stop: memory.asked_to_stop || output.detected_intent === "not_interested"
  };

  for (const key of Object.keys(output.collected_fields)) {
    if (!next.answered_questions.includes(key)) {
      next.answered_questions = [...next.answered_questions, key];
    }
  }

  return next;
}

export function buildMemorySummary(memory: StructuredMemory) {
  const parts = [
    memory.full_name ? `שם: ${memory.full_name}` : null,
    memory.phone ? `טלפון: ${memory.phone}` : null,
    memory.interested_service ? `שירות: ${memory.interested_service}` : null,
    memory.main_goal ? `מטרה: ${memory.main_goal}` : null,
    memory.main_pain_point ? `כאב: ${memory.main_pain_point}` : null,
    memory.urgency ? `דחיפות: ${memory.urgency}` : null,
    memory.availability ? `זמינות: ${memory.availability}` : null,
    memory.objections.length ? `התנגדויות: ${memory.objections.join(", ")}` : null,
    memory.buying_signals.length ? `סימני קנייה: ${memory.buying_signals.join(", ")}` : null
  ].filter(Boolean);

  return parts.length ? parts.join(" | ") : "עדיין לא נאסף מידע משמעותי.";
}

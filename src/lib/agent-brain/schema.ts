import { z } from "zod";

export const conversationStateSchema = z.enum([
  "new_lead",
  "qualification",
  "warming_up",
  "objection_handling",
  "booking_ready",
  "follow_up_needed",
  "waiting_for_user",
  "waiting_for_owner",
  "transferred_to_owner",
  "booked",
  "closed_not_relevant",
  "closed_by_owner"
]);

export const leadTemperatureSchema = z.enum(["cold", "warm", "hot"]);
export const detectedIntentSchema = z.enum([
  "general_question",
  "service_interest",
  "price_request",
  "booking_request",
  "objection",
  "human_request",
  "not_interested",
  "unclear"
]);
export const nextRecommendedActionSchema = z.enum([
  "continue_conversation",
  "ask_qualification_question",
  "prepare_booking",
  "owner_follow_up",
  "create_follow_up",
  "close_not_relevant",
  "wait"
]);

export const agentStructuredOutputSchema = z.object({
  customer_reply: z.string().min(1),
  conversation_state: conversationStateSchema,
  lead_temperature: leadTemperatureSchema,
  lead_score: z.number().min(0).max(100),
  intent_score: z.number().min(0).max(100),
  engagement_score: z.number().min(0).max(100),
  booking_probability: z.number().min(0).max(100),
  confidence: z.number().min(0).max(100),
  detected_intent: detectedIntentSchema,
  detected_objections: z.array(z.string()),
  buying_signals: z.array(z.string()),
  collected_fields: z.record(z.string(), z.string()),
  missing_fields: z.array(z.string()),
  requires_human_takeover: z.boolean(),
  takeover_reason: z.string().nullable(),
  conversation_summary: z.string().min(1),
  internal_notes: z.string().min(1),
  next_recommended_action: nextRecommendedActionSchema,
  follow_up_needed: z.boolean(),
  follow_up_delay_minutes: z.number().int().positive().nullable(),
  follow_up_reason: z.string().nullable()
});

export function validateAgentOutput(output: unknown) {
  return agentStructuredOutputSchema.safeParse(output);
}

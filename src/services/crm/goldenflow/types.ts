export type GoldenFlowLeadPayload = {
  external_lead_id: string;
  external_business_id: string;
  full_name: string;
  phone: string;
  email?: string;
  source: string;
  source_detail?: string;
  status: string;
  temperature: "cold" | "warm" | "hot";
  lead_score: number;
  interested_service?: string;
  main_goal?: string;
  pain_points: string[];
  objections: string[];
  buying_signals: string[];
  conversation_summary: string;
  next_action: string;
  follow_up_at?: string;
  last_message_at: string;
  conversation_external_id: string;
  requires_human_action: boolean;
  metadata: Record<string, unknown>;
  created_by_source: "goldenflow_ai_assistant";
};

export type GoldenFlowTaskPayload = {
  external_task_id: string;
  lead_external_id: string;
  external_business_id: string;
  title: string;
  description: string;
  due_at: string;
  priority: "low" | "medium" | "high" | "urgent";
  task_type: "follow_up" | "owner_reply" | "booking" | "hot_lead" | "review_conversation";
  source: "goldenflow_ai_assistant";
  conversation_external_id: string;
  metadata: Record<string, unknown>;
};

export type GoldenFlowConversationSummaryPayload = {
  lead_external_id: string;
  conversation_external_id: string;
  external_business_id: string;
  summary: string;
  detected_intent: string;
  qualification_status: string;
  pain_points: string[];
  goals: string[];
  objections: string[];
  buying_signals: string[];
  lead_temperature: "cold" | "warm" | "hot";
  lead_score: number;
  recommended_action: string;
  requires_human_action: boolean;
  last_message_at: string;
  metadata: Record<string, unknown>;
};

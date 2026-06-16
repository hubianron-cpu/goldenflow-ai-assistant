export type LeadHeat = "קר" | "בינוני" | "חם";
export type ConversationStatus = "פתוחה" | "דורשת טיפול" | "מוכנה לשיחה" | "לא רלוונטי";
export type LeadTemperature = "cold" | "warm" | "hot";
export type ConversationState =
  | "new_lead"
  | "qualification"
  | "warming_up"
  | "objection_handling"
  | "booking_ready"
  | "follow_up_needed"
  | "waiting_for_user"
  | "waiting_for_owner"
  | "transferred_to_owner"
  | "booked"
  | "closed_not_relevant"
  | "closed_by_owner";
export type AiMode = "active" | "paused_by_owner" | "waiting_for_owner" | "resumed" | "disabled";
export type DetectedIntent =
  | "general_question"
  | "service_interest"
  | "price_request"
  | "booking_request"
  | "objection"
  | "human_request"
  | "not_interested"
  | "unclear";
export type NextRecommendedAction =
  | "continue_conversation"
  | "ask_qualification_question"
  | "prepare_booking"
  | "owner_follow_up"
  | "create_follow_up"
  | "close_not_relevant"
  | "wait";
export type ActionType =
  | "continue_ai_conversation"
  | "owner_reply"
  | "schedule_follow_up"
  | "prepare_booking"
  | "mark_not_relevant"
  | "close_conversation"
  | "wait_for_user"
  | "create_future_crm_task";
export type AutomationLevel = "off" | "draft_only" | "safe_auto_reply" | "full_qualification" | "follow_up_automation";
export type PilotStatus = "off" | "active" | "blocked" | "error";
export type JobType =
  | "process_incoming_message"
  | "run_agent"
  | "prepare_draft"
  | "send_outbound_message"
  | "sync_crm_action"
  | "process_message_status_update";
export type JobStatus = "pending" | "processing" | "completed" | "failed" | "cancelled" | "blocked";
export type MessageType = "text" | "image" | "audio" | "video" | "document" | "location" | "contact" | "sticker" | "interactive" | "unknown";
export type DeliveryStatus = "draft" | "queued" | "sent" | "delivered" | "read" | "failed" | "blocked" | "cancelled";

export type Business = {
  id: string;
  name: string;
  field: string;
  description: string;
  audience: string;
  services: string;
  tone: string;
  hours: string;
  faqs: string;
  prices?: string;
  forbiddenTopics: string;
  conversationGoal: "לקבוע שיחה" | "לאסוף פרטים" | "לסנן ליד" | "לחמם ליד";
  timezone: string;
  pilotSettings: PilotSettings;
};

export type PilotSettings = {
  pilotEnabled: boolean;
  agentEnabled: boolean;
  whatsappReceivingEnabled: boolean;
  whatsappSendingEnabled: boolean;
  crmSyncEnabled: boolean;
  phoneAllowlistEnabled: boolean;
  automationLevel: AutomationLevel;
  defaultCountry: "IL" | "US" | "unknown";
  debounceWindowSeconds: number;
  dailyMessageLimit: number;
};

export type Agent = {
  id: string;
  businessId: string;
  name: string;
  role: string;
  openingMessage: string;
  qualificationQuestions: string;
  behaviorInstructions: string;
  handoffRules: string;
  hotLeadRules: string;
  objectionRules: string;
  disqualificationRules: string;
  qualificationFields: QualificationField[];
};

export type QualificationField = {
  label: string;
  key:
    | "full_name"
    | "phone"
    | "email"
    | "interested_service"
    | "main_goal"
    | "main_pain_point"
    | "urgency"
    | "previous_attempts"
    | "availability"
    | "preferred_contact_time"
    | "budget"
    | "location"
    | "lead_source"
    | "free_text_notes";
  required: boolean;
  active: boolean;
  priority: number;
  questionTemplate: string;
  allowedToAsk: boolean;
  sensitive: boolean;
  completionCondition: string;
};

export type Lead = {
  id: string;
  businessId: string;
  name: string;
  phone: string;
  normalizedPhone: string;
  source: string;
  status: ConversationStatus;
  heat: LeadHeat;
  leadTemperature: LeadTemperature;
  leadScore: number;
  intentScore: number;
  engagementScore: number;
  bookingProbability: number;
  lastScoreReason: string;
  needSummary: string;
  nextAction: string;
  nextRecommendedAction: NextRecommendedAction;
  followUpAt: string;
  externalLeadId?: string;
  doNotContact: boolean;
  doNotContactAt: string | null;
  optOutReason: string | null;
  updatedAt: string;
};

export type Message = {
  id: string;
  conversationId: string;
  businessId: string;
  externalMessageId?: string;
  externalEventId?: string;
  provider: "simulator" | "whatsapp_cloud" | "mock_whatsapp";
  messageType: MessageType;
  deliveryStatus: DeliveryStatus;
  idempotencyKey: string;
  sender: "lead" | "agent";
  body: string;
  rawPayloadReference?: string;
  createdAt: string;
};

export type StructuredMemory = {
  full_name?: string;
  phone?: string;
  email?: string;
  interested_service?: string;
  main_goal?: string;
  main_pain_point?: string;
  urgency?: string;
  previous_attempts?: string;
  availability?: string;
  preferred_contact_time?: string;
  budget?: string;
  location?: string;
  lead_source?: string;
  free_text_notes?: string;
  asked_questions: string[];
  answered_questions: string[];
  objections: string[];
  buying_signals: string[];
  price_requested: boolean;
  wants_booking: boolean;
  requested_human: boolean;
  asked_to_stop: boolean;
  agreed_next_action?: string;
};

export type ConversationSummary = {
  shortSummary: string;
  mainGoal?: string;
  painPoints: string[];
  interestedService?: string;
  objections: string[];
  buyingSignals: string[];
  qualificationStatus: "not_started" | "in_progress" | "qualified" | "not_qualified";
  collectedInformation: Record<string, string>;
  missingInformation: string[];
  currentState: ConversationState;
  nextRecommendedAction: NextRecommendedAction;
  ownerAttentionRequired: boolean;
};

export type Conversation = {
  id: string;
  businessId: string;
  leadId: string;
  leadName: string;
  leadPhone: string;
  lastMessage: string;
  heat: LeadHeat;
  leadTemperature: LeadTemperature;
  leadScore: number;
  intentScore: number;
  engagementScore: number;
  bookingProbability: number;
  status: ConversationStatus;
  conversationState: ConversationState;
  aiMode: AiMode;
  needsHuman: boolean;
  requiresOwnerAttention: boolean;
  takeoverReason: string | null;
  whatsappConnectionId?: string;
  processingLockAt: string | null;
  processingLockExpiresAt: string | null;
  summary: string;
  summaryDetails: ConversationSummary;
  structuredMemory: StructuredMemory;
  memorySummary: string;
  lastMemoryUpdateAt: string | null;
  nextAction: string;
  nextRecommendedAction: NextRecommendedAction;
  externalConversationId?: string;
  lastAgentRunId?: string;
  updatedAt: string;
};

export type AgentRun = {
  id: string;
  promptVersionId: string;
  model: "local-rules-v2";
  startedAt: string;
  completedAt: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  success: boolean;
  retryCount: number;
  outputValid: boolean;
  errorType?: string;
  errorMessage?: string;
  reply: string;
  heat: LeadHeat;
  output: AgentStructuredOutput;
  status: ConversationStatus;
  needsHuman: boolean;
  internalSummary: string;
  nextAction: string;
};

export type AgentStructuredOutput = {
  customer_reply: string;
  conversation_state: ConversationState;
  lead_temperature: LeadTemperature;
  lead_score: number;
  intent_score: number;
  engagement_score: number;
  booking_probability: number;
  confidence: number;
  detected_intent: DetectedIntent;
  detected_objections: string[];
  buying_signals: string[];
  collected_fields: Record<string, string>;
  missing_fields: string[];
  requires_human_takeover: boolean;
  takeover_reason: string | null;
  conversation_summary: string;
  internal_notes: string;
  next_recommended_action: NextRecommendedAction;
  follow_up_needed: boolean;
  follow_up_delay_minutes: number | null;
  follow_up_reason: string | null;
};

export type ConversationStateEvent = {
  id: string;
  businessId: string;
  conversationId: string;
  previousState: ConversationState;
  newState: ConversationState;
  reason: string;
  agentRunId: string;
  createdAt: string;
};

export type LeadScoreEvent = {
  id: string;
  businessId: string;
  leadId: string;
  previousScore: number;
  newScore: number;
  reason: string;
  agentRunId: string;
  createdAt: string;
};

export type PromptVersion = {
  id: string;
  businessId: string;
  aiAgentId: string;
  versionNumber: number;
  status: "draft" | "active" | "archived";
  systemPrompt: string;
  agentInstructions: string;
  qualificationRules: string;
  takeoverRules: string;
  createdAt: string;
  activatedAt: string | null;
  archivedAt: string | null;
};

export type AgentAction = {
  id: string;
  businessId: string;
  actionType: ActionType;
  reason: string;
  priority: "low" | "medium" | "high" | "urgent";
  recommendedDueAt: string;
  conversationId: string;
  leadId: string;
  createdAt: string;
};

export type FollowUpDraft = {
  id: string;
  businessId: string;
  leadId: string;
  conversationId: string;
  status: "draft" | "recommended" | "approved" | "cancelled" | "completed" | "expired";
  draftMessage: string;
  reason: string;
  scheduledFor: string;
  createdBy: "agent" | "owner";
  createdAt: string;
  updatedAt: string;
};

export type WhatsAppConnection = {
  id: string;
  businessId: string;
  provider: "whatsapp_cloud" | "mock_whatsapp";
  phoneNumberId: string;
  businessAccountId?: string;
  receiverPhone: string;
  status: "not_configured" | "mock" | "connected" | "error";
  lastWebhookAt: string | null;
  lastMessageAt: string | null;
  lastSendAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NormalizedIncomingMessage = {
  provider: "whatsapp_cloud" | "mock_whatsapp";
  externalEventId: string;
  externalMessageId: string;
  externalConversationId: string;
  businessId: string;
  senderPhone: string;
  receiverPhone: string;
  normalizedSenderPhone: string;
  normalizedReceiverPhone: string;
  messageType: MessageType;
  text: string;
  providerTimestamp: string;
  receivedAt: string;
  replyToMessageId: string | null;
  isSupported: boolean;
  rawPayloadReference: string;
};

export type BackgroundJob = {
  id: string;
  businessId: string;
  jobType: JobType;
  entityId: string;
  status: JobStatus;
  attemptCount: number;
  maxAttempts: number;
  scheduledFor: string;
  lockedAt: string | null;
  lockedBy: string | null;
  lockExpiresAt: string | null;
  lastError: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
};

export type MessageProcessingBatch = {
  id: string;
  businessId: string;
  conversationId: string;
  status: JobStatus;
  firstMessageAt: string;
  lastMessageAt: string;
  processAfter: string;
  messageIds: string[];
  agentRunId: string | null;
  createdAt: string;
  processedAt: string | null;
  failedAt: string | null;
};

export type OutboundDraft = {
  id: string;
  businessId: string;
  leadId: string;
  conversationId: string;
  sourceMessageIds: string[];
  originalDraftMessage: string;
  draftMessage: string;
  status: "draft" | "pending_approval" | "approved" | "edited" | "rejected" | "expired" | "sent" | "blocked";
  confidence: number;
  blockReason: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  editedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OutboundMessageAttempt = {
  id: string;
  businessId: string;
  draftId: string;
  conversationId: string;
  leadId: string;
  provider: "whatsapp_cloud" | "mock_whatsapp";
  status: DeliveryStatus;
  idempotencyKey: string;
  externalMessageId: string | null;
  attemptCount: number;
  maxAttempts: number;
  lastError: string | null;
  createdAt: string;
  sentAt: string | null;
  updatedAt: string;
};

export type CRMAction = {
  id: string;
  businessId: string;
  actionType: "create_lead" | "update_lead" | "update_status" | "create_task" | "send_summary" | "sync_activity";
  entityId: string;
  payload: Record<string, unknown>;
  status: "pending" | "blocked" | "completed" | "failed" | "ignored_duplicate";
  idempotencyKey: string;
  attemptCount: number;
  lastError: string | null;
  createdAt: string;
  processedAt: string | null;
};

export type AuditLog = {
  id: string;
  businessId: string;
  actorType: "user" | "ai" | "system" | "webhook" | "integration";
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  result: "success" | "blocked" | "failed" | "duplicate";
  metadata: Record<string, string | number | boolean | null>;
  createdAt: string;
};

export type NotificationItem = {
  id: string;
  businessId: string;
  type:
    | "draft_pending_approval"
    | "hot_lead"
    | "human_requested"
    | "unsupported_media"
    | "opt_out"
    | "whatsapp_send_failed"
    | "crm_sync_failed"
    | "ai_failed"
    | "usage_limit"
    | "agent_disabled"
    | "conversation_waiting";
  title: string;
  body: string;
  entityId: string;
  read: boolean;
  createdAt: string;
};

export type PilotUsageCounters = {
  incomingMessagesCount: number;
  outgoingMessagesCount: number;
  draftsCreated: number;
  draftsApproved: number;
  draftsEdited: number;
  draftsRejected: number;
  draftsExpired: number;
  autoRepliesSent: number;
  ownerTakeovers: number;
  optOutCount: number;
  conversationsWaitingForOwner: number;
  hotLeadsDetected: number;
  crmLeadsCreated: number;
  crmLeadsUpdated: number;
  crmTasksCreated: number;
  crmSyncFailures: number;
  whatsappSendFailures: number;
  aiFailures: number;
  duplicateEventsIgnored: number;
  averageResponseTime: number;
  averageApprovalTime: number;
  draftEditRate: number;
};

export type IntegrationEvent = {
  id: string;
  businessId: string;
  provider: "goldenflow_crm" | "whatsapp_cloud" | "mock_whatsapp";
  eventType: string;
  externalEventId?: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  status: "pending" | "processing" | "completed" | "failed" | "ignored_duplicate";
  attemptCount: number;
  lastError: string | null;
  createdAt: string;
  processedAt: string | null;
};

export type AppState = {
  currentUser: { id: string; name: string; email: string } | null;
  business: Business | null;
  agent: Agent | null;
  leads: Lead[];
  conversations: Conversation[];
  messages: Message[];
  agentRuns: AgentRun[];
  promptVersions: PromptVersion[];
  stateEvents: ConversationStateEvent[];
  leadScoreEvents: LeadScoreEvent[];
  agentActions: AgentAction[];
  followUpQueue: FollowUpDraft[];
  integrationEvents: IntegrationEvent[];
  whatsappConnections: WhatsAppConnection[];
  backgroundJobs: BackgroundJob[];
  messageProcessingBatches: MessageProcessingBatch[];
  outboundDrafts: OutboundDraft[];
  outboundMessageAttempts: OutboundMessageAttempt[];
  crmActions: CRMAction[];
  auditLogs: AuditLog[];
  notifications: NotificationItem[];
  phoneAllowlist: string[];
  pilotUsageCounters: PilotUsageCounters;
};

import { buildPrompt } from "@/lib/prompt/builder";
import { buildMemorySummary, updateMemory } from "@/lib/conversation/memory";
import { chooseSafeTransition } from "@/lib/conversation/state-machine";
import { calculateLeadScore, analyzeSignals } from "@/lib/agent-brain/scoring";
import { validateAgentOutput } from "@/lib/agent-brain/schema";
import { chooseNextQualificationQuestion, extractFieldsFromText, getActiveQualificationFields, getMissingFields } from "@/lib/qualification/framework";
import type {
  Agent,
  AgentRun,
  AgentStructuredOutput,
  Business,
  Conversation,
  ConversationSummary,
  LeadHeat,
  Message,
  PromptVersion,
  StructuredMemory
} from "@/lib/store/types";

type BrainInput = {
  userMessage: string;
  history: Message[];
  business: Business;
  agent: Agent;
  conversation: Conversation;
  promptVersion: PromptVersion;
};

const fallbackReply = "אני מעביר את השיחה לבדיקה כדי לוודא שתקבל תשובה מדויקת.";
const maxRecentMessages = 6;

function toHebrewHeat(temperature: AgentStructuredOutput["lead_temperature"]): LeadHeat {
  if (temperature === "hot") return "חם";
  if (temperature === "warm") return "בינוני";
  return "קר";
}

function countPseudoTokens(text: string) {
  return Math.ceil(text.length / 4);
}

function makeSafeFallback(input: BrainInput, startedAt: string, reason: string): AgentRun {
  const completedAt = new Date().toISOString();
  const output: AgentStructuredOutput = {
    customer_reply: fallbackReply,
    conversation_state: "waiting_for_owner",
    lead_temperature: input.conversation.leadTemperature,
    lead_score: input.conversation.leadScore,
    intent_score: input.conversation.intentScore,
    engagement_score: input.conversation.engagementScore,
    booking_probability: input.conversation.bookingProbability,
    confidence: Math.round((input.conversation.intentScore + input.conversation.engagementScore + input.conversation.bookingProbability) / 3),
    detected_intent: "unclear",
    detected_objections: [],
    buying_signals: [],
    collected_fields: {},
    missing_fields: input.conversation.summaryDetails.missingInformation,
    requires_human_takeover: true,
    takeover_reason: reason,
    conversation_summary: input.conversation.summary || "נדרש מעבר לבעל העסק.",
    internal_notes: reason,
    next_recommended_action: "owner_follow_up",
    follow_up_needed: false,
    follow_up_delay_minutes: null,
    follow_up_reason: null
  };

  return {
    id: `run_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    promptVersionId: input.promptVersion.id,
    model: "local-rules-v2",
    startedAt,
    completedAt,
    latencyMs: new Date(completedAt).getTime() - new Date(startedAt).getTime(),
    inputTokens: countPseudoTokens(input.userMessage),
    outputTokens: countPseudoTokens(fallbackReply),
    estimatedCost: 0,
    success: false,
    retryCount: 1,
    outputValid: true,
    errorType: "safe_fallback",
    errorMessage: reason,
    reply: fallbackReply,
    heat: toHebrewHeat(output.lead_temperature),
    output,
    status: "דורשת טיפול",
    needsHuman: true,
    internalSummary: output.internal_notes,
    nextAction: "בעל העסק צריך לבדוק את השיחה"
  };
}

function buildCustomerReply(input: {
  business: Business;
  conversation: Conversation;
  memory: StructuredMemory;
  detectedIntent: AgentStructuredOutput["detected_intent"];
  requiresHuman: boolean;
  qualificationQuestion: string | null;
  leadScore: number;
}) {
  if (input.requiresHuman && input.detectedIntent === "human_request") {
    return "ברור, אעביר לבעל העסק. מה מספר הטלפון שהכי נוח לחזור אליו?";
  }
  if (input.requiresHuman && input.detectedIntent === "booking_request") {
    return "נשמע מתאים להתקדם לשיחה קצרה. מתי יהיה לך נוח שבעל העסק יחזור אליך?";
  }
  if (input.detectedIntent === "price_request" && !input.business.prices?.trim()) {
    return "כדי לא לתת מחיר לא מדויק, עדיף שבעל העסק יחזור אליך. מה בדיוק חשוב לך לפתור?";
  }
  if (input.detectedIntent === "price_request" && input.business.prices?.trim()) {
    return `יש כמה אפשרויות, ובגדול המחירים שהוגדרו הם: ${input.business.prices}. מה היקף הצורך שלך כרגע?`;
  }
  if (input.detectedIntent === "not_interested") {
    return "מבין לגמרי, לא אמשיך להציק. אם זה יהיה רלוונטי בהמשך אפשר לחזור אלינו.";
  }
  if (input.qualificationQuestion) {
    return input.qualificationQuestion;
  }
  if (input.leadScore >= 70) {
    return "נשמע שיש כאן צורך די ברור. מתי יהיה לך נוח לשיחה קצרה?";
  }
  return "הבנתי. מה הדבר המרכזי שהיית רוצה לשפר כרגע בתהליך הלידים או הפולואפים?";
}

function buildSummary(input: {
  previousSummary: ConversationSummary;
  output: AgentStructuredOutput;
  memory: StructuredMemory;
}) {
  return {
    shortSummary: input.output.conversation_summary,
    mainGoal: input.memory.main_goal,
    painPoints: input.memory.main_pain_point ? [input.memory.main_pain_point] : input.previousSummary.painPoints,
    interestedService: input.memory.interested_service,
    objections: input.output.detected_objections,
    buyingSignals: input.output.buying_signals,
    qualificationStatus: input.output.missing_fields.length === 0 ? "qualified" : "in_progress",
    collectedInformation: input.output.collected_fields,
    missingInformation: input.output.missing_fields,
    currentState: input.output.conversation_state,
    nextRecommendedAction: input.output.next_recommended_action,
    ownerAttentionRequired: input.output.requires_human_takeover
  } satisfies ConversationSummary;
}

export function runAgentBrain(input: BrainInput): AgentRun {
  const startedAt = new Date().toISOString();
  const recentMessages = input.history.slice(-maxRecentMessages);
  const qualificationFields = getActiveQualificationFields(input.agent);
  const prompt = buildPrompt({
    business: input.business,
    agent: input.agent,
    promptVersion: input.promptVersion,
    conversation: input.conversation,
    recentMessages,
    qualificationFields
  });

  if (input.conversation.aiMode !== "active" && input.conversation.aiMode !== "resumed") {
    return makeSafeFallback(input, startedAt, "AI paused by owner; automatic reply blocked.");
  }

  const previousMemory = input.conversation.structuredMemory;
  const analysis = analyzeSignals(input.userMessage);
  const extractedFields = extractFieldsFromText(input.userMessage, qualificationFields, previousMemory);
  const memoryBeforeScoring = updateMemory(previousMemory, {
    customer_reply: "",
    conversation_state: input.conversation.conversationState,
    lead_temperature: input.conversation.leadTemperature,
    lead_score: input.conversation.leadScore,
    intent_score: input.conversation.intentScore,
    engagement_score: input.conversation.engagementScore,
    booking_probability: input.conversation.bookingProbability,
    confidence: 0,
    detected_intent: analysis.detectedIntent,
    detected_objections: analysis.objections,
    buying_signals: analysis.buyingSignals,
    collected_fields: extractedFields,
    missing_fields: [],
    requires_human_takeover: false,
    takeover_reason: null,
    conversation_summary: input.conversation.summary,
    internal_notes: "",
    next_recommended_action: "continue_conversation",
    follow_up_needed: false,
    follow_up_delay_minutes: null,
    follow_up_reason: null
  });
  const score = calculateLeadScore({
    previousScore: input.conversation.leadScore,
    analysis,
    memory: memoryBeforeScoring,
    messages: input.history
  });
  const missingFields = getMissingFields(qualificationFields, memoryBeforeScoring);
  const qualificationQuestion = chooseNextQualificationQuestion(qualificationFields, memoryBeforeScoring, recentMessages);
  const requiresHuman =
    analysis.detectedIntent === "human_request" ||
    analysis.detectedIntent === "booking_request" ||
    analysis.detectedIntent === "objection" ||
    score.leadTemperature === "hot";
  const requestedState = analysis.detectedIntent === "not_interested"
    ? "closed_not_relevant"
    : requiresHuman && analysis.detectedIntent === "booking_request"
      ? "booking_ready"
      : requiresHuman
        ? "waiting_for_owner"
        : missingFields.length
          ? "qualification"
          : score.leadTemperature === "warm"
            ? "warming_up"
            : "waiting_for_user";

  const customerReply = buildCustomerReply({
    business: input.business,
    conversation: input.conversation,
    memory: memoryBeforeScoring,
    detectedIntent: analysis.detectedIntent,
    requiresHuman,
    qualificationQuestion,
    leadScore: score.leadScore
  });
  const rawOutput: AgentStructuredOutput = {
    customer_reply: customerReply,
    conversation_state: requestedState,
    lead_temperature: score.leadTemperature,
    lead_score: score.leadScore,
    intent_score: score.intentScore,
    engagement_score: score.engagementScore,
    booking_probability: score.bookingProbability,
    confidence: Math.round((score.intentScore + score.engagementScore + score.bookingProbability) / 3),
    detected_intent: analysis.detectedIntent,
    detected_objections: analysis.objections,
    buying_signals: analysis.buyingSignals,
    collected_fields: extractedFields,
    missing_fields: missingFields,
    requires_human_takeover: requiresHuman,
    takeover_reason: requiresHuman ? "נדרש בעל עסק לפי intent או lead score" : null,
    conversation_summary: buildMemorySummary(memoryBeforeScoring),
    internal_notes: score.reason,
    next_recommended_action: requiresHuman ? "owner_follow_up" : missingFields.length ? "ask_qualification_question" : "continue_conversation",
    follow_up_needed: !requiresHuman && analysis.detectedIntent === "general_question" && input.history.length > 3,
    follow_up_delay_minutes: !requiresHuman && analysis.detectedIntent === "general_question" && input.history.length > 3 ? 1440 : null,
    follow_up_reason: !requiresHuman && analysis.detectedIntent === "general_question" && input.history.length > 3 ? "השיחה פתוחה ונדרשת תזכורת אם אין תגובה." : null
  };
  const transition = chooseSafeTransition(input.conversation.conversationState, rawOutput);
  const output = {
    ...rawOutput,
    conversation_state: transition.state,
    internal_notes: `${rawOutput.internal_notes}; transition=${transition.reason}`
  };
  const validation = validateAgentOutput(output);

  if (!validation.success) {
    return makeSafeFallback(input, startedAt, "Agent output validation failed.");
  }

  const completedAt = new Date().toISOString();
  const validatedOutput = validation.data;
  return {
    id: `run_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    promptVersionId: input.promptVersion.id,
    model: "local-rules-v2",
    startedAt,
    completedAt,
    latencyMs: new Date(completedAt).getTime() - new Date(startedAt).getTime(),
    inputTokens: countPseudoTokens(`${prompt}\n${input.userMessage}`),
    outputTokens: countPseudoTokens(JSON.stringify(validatedOutput)),
    estimatedCost: 0,
    success: true,
    retryCount: 0,
    outputValid: true,
    reply: validatedOutput.customer_reply,
    heat: toHebrewHeat(validatedOutput.lead_temperature),
    output: validatedOutput,
    status: validatedOutput.requires_human_takeover ? "דורשת טיפול" : validatedOutput.conversation_state === "closed_not_relevant" ? "לא רלוונטי" : "פתוחה",
    needsHuman: validatedOutput.requires_human_takeover,
    internalSummary: validatedOutput.conversation_summary,
    nextAction: validatedOutput.next_recommended_action
  };
}

export function summarizeConversation(previousSummary: ConversationSummary, output: AgentStructuredOutput, memory: StructuredMemory) {
  return buildSummary({ previousSummary, output, memory });
}

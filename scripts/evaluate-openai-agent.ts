import { openAIProvider } from "../src/lib/ai/providers";
import { defaultAgent, defaultBusiness, initialState } from "../src/lib/store/demo-data";
import { createEmptyMemory } from "../src/lib/store/local-store";
import { readServerStageEnvironment } from "../src/lib/staging/env";
import type { Conversation } from "../src/lib/store/types";

const env = readServerStageEnvironment();

if (!env.OPENAI_API_KEY) {
  console.log("agent:evaluate:openai blocked_missing_credentials: OPENAI_API_KEY is not configured.");
  process.exit(2);
}

const now = new Date().toISOString();
const conversation: Conversation = {
  id: "eval_conv_openai",
  businessId: defaultBusiness.id,
  leadId: "eval_lead_openai",
  leadName: "דניאל",
  leadPhone: "0501234567",
  lastMessage: "",
  heat: "קר",
  leadTemperature: "cold",
  leadScore: 0,
  intentScore: 0,
  engagementScore: 0,
  bookingProbability: 0,
  status: "פתוחה",
  conversationState: "new_lead",
  aiMode: "active",
  needsHuman: false,
  requiresOwnerAttention: false,
  takeoverReason: null,
  processingLockAt: null,
  processingLockExpiresAt: null,
  summary: "שיחת הערכה מול OpenAI.",
  summaryDetails: {
    shortSummary: "שיחת הערכה מול OpenAI.",
    painPoints: [],
    objections: [],
    buyingSignals: [],
    qualificationStatus: "not_started",
    collectedInformation: {},
    missingInformation: [],
    currentState: "new_lead",
    nextRecommendedAction: "continue_conversation",
    ownerAttentionRequired: false
  },
  structuredMemory: createEmptyMemory(),
  memorySummary: "",
  lastMemoryUpdateAt: null,
  nextAction: "להתחיל שיחה",
  nextRecommendedAction: "continue_conversation",
  updatedAt: now
};

async function main() {
  const result = await openAIProvider.run({
    userMessage: "שלום, אני רוצה להבין מחיר ומה אתם עושים",
    history: [],
    business: defaultBusiness,
    agent: defaultAgent,
    conversation,
    promptVersion: initialState.promptVersions[0]
  });

  console.table([
    {
      testName: "OpenAI structured response smoke",
      model: result.model,
      success: result.success,
      outputValid: result.outputValid,
      errorType: result.errorType ?? null,
      detectedIntent: result.output.detected_intent
    }
  ]);

  if (!result.success || !result.outputValid) {
    process.exit(1);
  }
}

void main();

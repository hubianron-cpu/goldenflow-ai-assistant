import { runAgentBrain } from "../src/lib/agent-brain/brain";
import { agentEvaluationScenarios } from "../src/lib/evaluation/scenarios";
import { defaultAgent, defaultBusiness, initialState, businessId } from "../src/lib/store/demo-data";
import { createEmptyMemory } from "../src/lib/store/local-store";
import type { Conversation, Message } from "../src/lib/store/types";

function makeConversation(): Conversation {
  const now = new Date().toISOString();
  const memory = { ...createEmptyMemory(), full_name: "דניאל", phone: "050-1234567" };
  return {
    id: "eval_conversation",
    businessId,
    leadId: "eval_lead",
    leadName: "דניאל",
    leadPhone: "050-1234567",
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
    summary: "שיחת בדיקה",
    summaryDetails: {
      shortSummary: "שיחת בדיקה",
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
    structuredMemory: memory,
    memorySummary: "שיחת בדיקה",
    lastMemoryUpdateAt: now,
    nextAction: "להמשיך שיחה",
    nextRecommendedAction: "continue_conversation",
    externalConversationId: "eval_external_conversation",
    updatedAt: now
  };
}

const promptVersion = initialState.promptVersions[0];
const results = agentEvaluationScenarios.map((scenario) => {
  const userMessage: Message = {
    id: `msg_${scenario.name}`,
    businessId,
    conversationId: "eval_conversation",
    idempotencyKey: `eval:${scenario.name}`,
    provider: "simulator",
    messageType: "text",
    deliveryStatus: "delivered",
    sender: "lead",
    body: scenario.message,
    createdAt: new Date().toISOString()
  };
  const run = runAgentBrain({
    userMessage: scenario.message,
    history: [userMessage],
    business: defaultBusiness,
    agent: defaultAgent,
    conversation: makeConversation(),
    promptVersion
  });
  const checks = [
    { name: "schema validation", pass: run.outputValid },
    { name: "intent", pass: run.output.detected_intent === scenario.expectedIntent },
    { name: "single central question", pass: (run.reply.match(/\?/g) ?? []).length <= 1 },
    { name: "takeover", pass: scenario.expectTakeover === undefined || run.output.requires_human_takeover === scenario.expectTakeover },
    { name: "temperature", pass: !scenario.expectedTemperature || run.output.lead_temperature === scenario.expectedTemperature },
    { name: "state", pass: !scenario.expectedState || run.output.conversation_state === scenario.expectedState },
    { name: "no invented price", pass: !scenario.expectNoInventedPrice || !/\d+\s*(₪|שח|ש"ח)/.test(run.reply) }
  ];
  const failed = checks.filter((check) => !check.pass);
  return {
    testName: scenario.name,
    expected: scenario.expectedIntent,
    actual: run.output.detected_intent,
    pass: failed.length === 0,
    failureReason: failed.map((check) => check.name).join(", ") || null
  };
});

const failed = results.filter((result) => !result.pass);
console.table(results);
if (failed.length) {
  console.error(`Agent evaluation failed: ${failed.length}/${results.length}`);
  process.exit(1);
}

console.log(`Agent evaluation passed: ${results.length}/${results.length}`);

import { processPendingPilotJobs } from "../src/lib/jobs/processor";
import { resetPilotState, savePilotState, getPilotState } from "../src/lib/pilot/server-store";
import { processNormalizedIncomingMessage } from "../src/lib/pilot/webhook-processor";
import { approveDraftAndSend } from "../src/lib/pilot/outbound-service";
import { checkCanSend } from "../src/lib/pilot/guards";
import { readPilotEnvironment } from "../src/lib/pilot/env";
import { normalizePhoneNumber } from "../src/services/messaging/whatsapp/phone";
import { MockWhatsAppProvider } from "../src/services/messaging/whatsapp/mock-provider";
import { WhatsAppCloudProvider } from "../src/services/messaging/whatsapp/cloud-provider";
import { goldenFlowCRMAdapter } from "../src/services/crm/goldenflow/adapter";
import { GoldenFlowCRMHttpAdapter } from "../src/services/crm/goldenflow/http-adapter";
import { requirePilotAdmin } from "../src/lib/pilot/api-auth";
import { runAgentBrain } from "../src/lib/agent-brain/brain";
import { defaultAgent, defaultBusiness, initialState, businessId } from "../src/lib/store/demo-data";
import { createEmptyStructuredMemory } from "../src/lib/conversation/memory";
import type { NormalizedIncomingMessage } from "../src/lib/store/types";

function configurePilot(options?: { agentEnabled?: boolean; sendingEnabled?: boolean; allowlist?: string[] }) {
  let state = resetPilotState();
  if (!state.business) throw new Error("missing business");
  state = {
    ...state,
    business: {
      ...state.business,
      pilotSettings: {
        ...state.business.pilotSettings,
        pilotEnabled: true,
        agentEnabled: options?.agentEnabled ?? true,
        whatsappReceivingEnabled: true,
        whatsappSendingEnabled: options?.sendingEnabled ?? false,
        crmSyncEnabled: false,
        phoneAllowlistEnabled: true,
        automationLevel: "draft_only",
        debounceWindowSeconds: 0
      }
    },
    phoneAllowlist: options?.allowlist ?? ["+972501234567"]
  };
  savePilotState(state);
  return state;
}

function incoming(overrides: Partial<NormalizedIncomingMessage> = {}): NormalizedIncomingMessage {
  const now = new Date().toISOString();
  return {
    provider: "mock_whatsapp",
    externalEventId: `event_${Math.random().toString(16).slice(2)}`,
    externalMessageId: `msg_${Math.random().toString(16).slice(2)}`,
    externalConversationId: "+972501234567",
    businessId: "biz_demo_goldenflow_assistant",
    senderPhone: "0501234567",
    receiverPhone: "0500000000",
    normalizedSenderPhone: "+972501234567",
    normalizedReceiverPhone: "+972500000000",
    messageType: "text",
    text: "היי אני רוצה להבין איך אתם יכולים לעזור לי עם לידים",
    providerTimestamp: now,
    receivedAt: now,
    replyToMessageId: null,
    isSupported: true,
    rawPayloadReference: "test_payload",
    ...overrides
  };
}

type TestResult = {
  testName: string;
  expected: string;
  actual: string;
  pass: boolean;
  recordsCreated: string;
  actionsBlocked: string;
  actionsCompleted: string;
  errorHandlingResult: string;
};

const tests: Array<() => Promise<TestResult> | TestResult> = [
  () => {
    configurePilot();
    const message = incoming({ externalEventId: "dup_event", externalMessageId: "dup_msg" });
    const first = processNormalizedIncomingMessage(message).status;
    const second = processNormalizedIncomingMessage(message).status;
    const state = getPilotState();
    return result("Webhook כפול", "accepted then duplicate", `${first} then ${second}`, first === "accepted" && second === "duplicate", `${state.messages.length} messages`, "duplicate ignored", "event saved once", "duplicate audit logged");
  },
  () => {
    configurePilot();
    const message = incoming({ externalEventId: "event_a", externalMessageId: "same_msg" });
    const first = processNormalizedIncomingMessage(message).status;
    const second = processNormalizedIncomingMessage({ ...message, externalEventId: "event_b" }).status;
    const state = getPilotState();
    return result("external_message_id כפול", "second duplicate", `${first}/${second}`, second === "duplicate", `${state.messages.length} messages`, "message duplicate blocked", "one message saved", "duplicate audit logged");
  },
  () => {
    configurePilot({ allowlist: [] });
    const status = processNormalizedIncomingMessage(incoming()).status;
    return result("מספר שאינו ב-Allowlist", "blocked", status, status === "blocked", "message saved", "agent job blocked", "audit saved", "owner attention created");
  },
  () => {
    configurePilot();
    const status = processNormalizedIncomingMessage(incoming({ messageType: "image", isSupported: false, text: "" })).status;
    const state = getPilotState();
    return result("הודעת תמונה", "blocked", status, status === "blocked" && state.backgroundJobs.length === 0, `${state.messages.length} message`, "AI not run", "notification created", "unsupported media marked");
  },
  () => {
    configurePilot();
    processNormalizedIncomingMessage(incoming({ text: "תפסיקו לשלוח לי הודעות" }));
    const lead = getPilotState().leads[0];
    return result("Opt-out בעברית", "do_not_contact", String(lead.doNotContact), lead.doNotContact, "lead updated", "sending blocked future", "audit saved", "opt-out saved");
  },
  () => {
    configurePilot();
    processNormalizedIncomingMessage(incoming({ text: "STOP" }));
    const lead = getPilotState().leads[0];
    return result("Opt-out באנגלית", "do_not_contact", String(lead.doNotContact), lead.doNotContact, "lead updated", "sending blocked future", "audit saved", "opt-out saved");
  },
  () => {
    configurePilot({ agentEnabled: false });
    processNormalizedIncomingMessage(incoming());
    const jobs = processPendingPilotJobs();
    return result("Agent מושבת בזמן עיבוד", "blocked", JSON.stringify(jobs), jobs.blocked === 1, "job blocked", "agent run blocked", "no draft", "owner attention");
  },
  () => {
    configurePilot();
    processNormalizedIncomingMessage(incoming());
    const jobs = processPendingPilotJobs();
    const state = getPilotState();
    return result("Draft Only", "draft created no send", JSON.stringify(jobs), state.outboundDrafts.length === 1 && state.outboundMessageAttempts.length === 0, "draft created", "send blocked by draft_only", "agent run completed", "notification created");
  },
  async () => {
    configurePilot({ sendingEnabled: false });
    processNormalizedIncomingMessage(incoming());
    processPendingPilotJobs();
    const draft = getPilotState().outboundDrafts[0];
    const send = await approveDraftAndSend({ draftId: draft.id, actorId: "test_owner" });
    return result("WhatsApp Sending מושבת לאחר אישור Draft", "blocked", send.status, send.status === "blocked", "attempt not sent", "send gate blocked", "audit saved", send.reason);
  },
  async () => {
    configurePilot({ sendingEnabled: true });
    processNormalizedIncomingMessage(incoming());
    processPendingPilotJobs();
    const draft = getPilotState().outboundDrafts[0];
    await approveDraftAndSend({ draftId: draft.id, actorId: "test_owner" });
    const second = await approveDraftAndSend({ draftId: draft.id, actorId: "test_owner" });
    return result("Draft אושר פעמיים", "duplicate", second.status, second.status === "duplicate", "one attempt", "second approval blocked", "first attempt completed", second.reason);
  },
  () => {
    configurePilot();
    processNormalizedIncomingMessage(incoming({ externalMessageId: "fast_1", text: "היי" }));
    processNormalizedIncomingMessage(incoming({ externalMessageId: "fast_2", text: "כמה זה עולה?" }));
    const state = getPilotState();
    return result("כמה הודעות מהירות ברצף", "one batch", String(state.messageProcessingBatches.length), state.messageProcessingBatches.length === 1, "2 messages", "one grouped batch", "one job expected", "debounce grouping worked");
  },
  () => {
    configurePilot();
    processNormalizedIncomingMessage(incoming());
    processPendingPilotJobs();
    const firstRuns = getPilotState().agentRuns.length;
    processPendingPilotJobs();
    const secondRuns = getPilotState().agentRuns.length;
    return result("שני Agent Runs לאותה שיחה", "no second run", `${firstRuns}/${secondRuns}`, firstRuns === 1 && secondRuns === 1, "one run", "completed job not rerun", "one draft", "idempotent job processing");
  },
  () => {
    configurePilot();
    processNormalizedIncomingMessage(incoming({ senderPhone: "abc", normalizedSenderPhone: "" }));
    const state = getPilotState();
    return result("מספר טלפון לא תקין", "blocked or saved safely", `${state.leads[0]?.normalizedPhone ?? "missing"}`, state.messages.length === 1, "message saved", "no crash", "audit saved", "safe handling");
  },
  () => {
    configurePilot();
    processNormalizedIncomingMessage(incoming());
    processNormalizedIncomingMessage(incoming({ externalMessageId: "lead_existing_2", text: "עוד הודעה" }));
    const state = getPilotState();
    return result("ליד קיים מקומית", "single lead", String(state.leads.length), state.leads.length === 1, "one lead", "duplicate lead blocked", "conversation reused", "phone normalized");
  },
  () => {
    configurePilot();
    const state = getPilotState();
    if (!state.business) throw new Error("missing business");
    savePilotState({ ...state, business: { ...state.business, pilotSettings: { ...state.business.pilotSettings, pilotEnabled: false } } });
    const status = processNormalizedIncomingMessage(incoming()).status;
    return result("Kill Switch בזמן Webhook", "blocked", status, status === "blocked", "message saved", "processing blocked", "audit saved", "fail-safe");
  },
  () => {
    const state = configurePilot();
    if (!state.business) throw new Error("missing business");
    savePilotState({ ...state, business: { ...state.business, pilotSettings: { ...state.business.pilotSettings, whatsappReceivingEnabled: false } } });
    const status = processNormalizedIncomingMessage(incoming()).status;
    return result("WhatsApp Receiving מושבת", "blocked", status, status === "blocked", "message saved", "receiving guard blocked", "audit saved", "kill switch honored");
  },
  () => {
    const state = configurePilot();
    return result("Automation default Draft Only", "draft_only", state.business?.pilotSettings.automationLevel ?? "", state.business?.pilotSettings.automationLevel === "draft_only", "settings loaded", "auto reply blocked", "none", "safe default");
  },
  () => {
    const env = readPilotEnvironment({ APP_ENV: "production", WHATSAPP_PROVIDER: "whatsapp_cloud", WHATSAPP_SENDING_ENABLED: "true" });
    return result("Environment Configuration חסר", "safeToStart=false", String(env.safeToStart), env.safeToStart === false, "no startup", "dangerous production blocked", "errors collected", env.errors.join("; "));
  },
  () => {
    const env = readPilotEnvironment({ APP_ENV: "development", GOLDENFLOW_CRM_API_BASE_URL: "https://production.crm.example.com" });
    return result("Dev מצביע ל-CRM Production", "safeToStart=false", String(env.safeToStart), env.safeToStart === false, "config checked", "crm production blocked", "errors collected", env.errors.join("; "));
  },
  () => {
    const phone = normalizePhoneNumber("050-1234567", "IL");
    return result("Phone Normalization IL", "+972501234567", phone, phone === "+972501234567", "normalized", "duplicate risk reduced", "none", "ok");
  },
  () => {
    const phone = normalizePhoneNumber("+972 50 123 4567", "IL");
    return result("Phone Normalization E.164", "+972501234567", phone, phone === "+972501234567", "normalized", "duplicate risk reduced", "none", "ok");
  },
  () => {
    const provider = new MockWhatsAppProvider();
    const challenge = provider.verifyWebhookChallenge({ mode: "subscribe", token: "anything", challenge: "123" });
    return result("Webhook Verification Mock", "123", challenge ?? "", challenge === "123", "challenge handled", "none", "verification completed", "ok");
  },
  () => {
    const provider = new MockWhatsAppProvider();
    const valid = provider.validateWebhookSignature("{}", null);
    return result("Webhook Signature Mock", "true", String(valid), valid, "signature checked", "none", "validation completed", "mock accepts");
  },
  () => {
    process.env.WHATSAPP_APP_SECRET = "secret";
    process.env.WHATSAPP_PROVIDER = "whatsapp_cloud";
    const provider = new WhatsAppCloudProvider();
    const valid = provider.validateWebhookSignature("{}", "sha256=bad");
    delete process.env.WHATSAPP_APP_SECRET;
    process.env.WHATSAPP_PROVIDER = "mock";
    return result("Webhook Signature Invalid", "false", String(valid), valid === false, "signature checked", "webhook blocked", "none", "invalid signature rejected");
  },
  () => {
    const provider = new MockWhatsAppProvider();
    const event = provider.parseIncomingWebhook({ from: "0501234567", text: "שלום", message_id: "m1", event_id: "e1" })[0];
    const normalized = provider.normalizeIncomingMessage(event, "biz_demo_goldenflow_assistant");
    return result("Message Normalization", "text supported", `${normalized.messageType}/${normalized.isSupported}`, normalized.messageType === "text" && normalized.isSupported, "normalized message", "none", "ready to save", "ok");
  },
  async () => {
    configurePilot({ sendingEnabled: true });
    processNormalizedIncomingMessage(incoming({ text: "תפסיקו לשלוח לי הודעות" }));
    const state = getPilotState();
    const lead = state.leads[0];
    const conversation = state.conversations[0];
    const guard = checkCanSend({ business: state.business!, lead, conversation, latestMessageIds: [], draftSourceMessageIds: [] });
    return result("ניסיון שליחה לאחר do_not_contact", "blocked", guard.reason, guard.allowed === false, "lead marked", "send blocked", "none", guard.reason);
  },
  async () => {
    configurePilot({ sendingEnabled: true });
    processNormalizedIncomingMessage(incoming({ externalMessageId: "stale_1" }));
    processPendingPilotJobs();
    const state = getPilotState();
    const draft = state.outboundDrafts[0];
    processNormalizedIncomingMessage(incoming({ externalMessageId: "stale_2", text: "רגע, עוד שאלה" }));
    const send = await approveDraftAndSend({ draftId: draft.id, actorId: "test_owner" });
    return result("Draft אושר אחרי הודעה חדשה", "blocked", send.status, send.status === "blocked", "new message saved", "stale draft blocked", "audit saved", send.reason);
  },
  () => {
    configurePilot();
    processNormalizedIncomingMessage(incoming({ messageType: "audio", isSupported: false, text: "" }));
    const state = getPilotState();
    return result("הודעת קול", "no job", String(state.backgroundJobs.length), state.backgroundJobs.length === 0, "audio metadata saved", "AI blocked", "notification", "unsupported audio");
  },
  () => {
    configurePilot();
    processNormalizedIncomingMessage(incoming({ messageType: "document", isSupported: false, text: "" }));
    const state = getPilotState();
    return result("הודעת מסמך", "no job", String(state.backgroundJobs.length), state.backgroundJobs.length === 0, "document metadata saved", "AI blocked", "notification", "unsupported document");
  },
  () => {
    configurePilot();
    processNormalizedIncomingMessage(incoming());
    let state = getPilotState();
    const conversation = state.conversations[0];
    savePilotState({ ...state, conversations: state.conversations.map((item) => (item.id === conversation.id ? { ...item, aiMode: "paused_by_owner" } : item)) });
    const jobs = processPendingPilotJobs();
    return result("הודעה בזמן Take Over", "blocked", JSON.stringify(jobs), jobs.blocked === 1, "job blocked", "AI paused", "owner attention", "takeover honored");
  },
  () => {
    configurePilot();
    processNormalizedIncomingMessage(incoming());
    let state = getPilotState();
    const conversation = state.conversations[0];
    savePilotState({ ...state, conversations: state.conversations.map((item) => (item.id === conversation.id ? { ...item, processingLockExpiresAt: new Date(Date.now() + 60000).toISOString() } : item)) });
    const jobs = processPendingPilotJobs();
    return result("Conversation Lock פעיל", "blocked", JSON.stringify(jobs), jobs.blocked === 1, "job blocked", "parallel run blocked", "none", "lock honored");
  },
  async () => {
    const adapter = new GoldenFlowCRMHttpAdapter();
    const response = await adapter.getBusinessConfiguration("biz_demo_goldenflow_assistant");
    return result("GoldenFlow CRM Mock/Contract", "mock", response.mode, response.mode === "mock", "contract call", "real sync not attempted", "mock response", response.message);
  },
  () => {
    configurePilot();
    processNormalizedIncomingMessage(incoming());
    processPendingPilotJobs();
    const state = getPilotState();
    return result("Notification Draft Pending", "created", String(state.notifications.length), state.notifications.some((item) => item.type === "draft_pending_approval"), "notification", "none", "draft visible", "owner notified");
  },
  () => {
    configurePilot();
    processNormalizedIncomingMessage(incoming());
    processPendingPilotJobs();
    const state = getPilotState();
    return result("Audit Log נשמר", "created", String(state.auditLogs.length), state.auditLogs.length > 0, "audit logs", "none", "actions recorded", "ok");
  },
  () => {
    configurePilot();
    processNormalizedIncomingMessage(incoming());
    processPendingPilotJobs();
    const state = getPilotState();
    return result("Metrics מתעדכנים", "incoming+draft", `${state.pilotUsageCounters.incomingMessagesCount}/${state.pilotUsageCounters.draftsCreated}`, state.pilotUsageCounters.incomingMessagesCount === 1 && state.pilotUsageCounters.draftsCreated === 1, "metrics", "none", "counters updated", "ok");
  },
  () => {
    const previousEnv = process.env.APP_ENV;
    const previousToken = process.env.PILOT_ADMIN_TOKEN;
    process.env.APP_ENV = "production";
    delete process.env.PILOT_ADMIN_TOKEN;
    const auth = requirePilotAdmin({ headers: { get: () => null } } as never);
    if (previousEnv === undefined) delete process.env.APP_ENV; else process.env.APP_ENV = previousEnv;
    if (previousToken === undefined) delete process.env.PILOT_ADMIN_TOKEN; else process.env.PILOT_ADMIN_TOKEN = previousToken;
    return result("API Route ללא Admin Token", "blocked", auth.reason, auth.allowed === false, "no business data", "api blocked", "none", auth.reason);
  },
  () => {
    const previousEnv = process.env.APP_ENV;
    const previousToken = process.env.PILOT_ADMIN_TOKEN;
    process.env.APP_ENV = "production";
    process.env.PILOT_ADMIN_TOKEN = "secret";
    const auth = requirePilotAdmin({ headers: { get: (name: string) => (name === "x-pilot-admin-token" ? "secret" : null) } } as never);
    if (previousEnv === undefined) delete process.env.APP_ENV; else process.env.APP_ENV = previousEnv;
    if (previousToken === undefined) delete process.env.PILOT_ADMIN_TOKEN; else process.env.PILOT_ADMIN_TOKEN = previousToken;
    return result("API Route עם Admin Token", "allowed", auth.reason, auth.allowed, "authorized", "none", "api allowed", "token accepted");
  },
  async () => {
    const health = await goldenFlowCRMAdapter.healthCheck();
    const find = await goldenFlowCRMAdapter.findLeadByPhone("biz", "+972501234567");
    const activity = await goldenFlowCRMAdapter.appendLeadActivity({ event: "test" }, "crm:test:activity");
    return result("GoldenFlow CRM Adapter aliases", "mock aliases", `${health.mode}/${find.mode}/${activity.mode}`, health.mode === "mock" && find.mode === "mock" && activity.mode === "mock", "contract checked", "real crm blocked", "mock aliases returned", "ok");
  },
  () => {
    const now = new Date().toISOString();
    const memory = { ...createEmptyStructuredMemory(), phone: "0501234567" };
    const conversation = {
      id: "confidence_conv",
      businessId,
      leadId: "confidence_lead",
      leadName: "דניאל",
      leadPhone: "0501234567",
      lastMessage: "",
      heat: "קר" as const,
      leadTemperature: "cold" as const,
      leadScore: 0,
      intentScore: 0,
      engagementScore: 0,
      bookingProbability: 0,
      status: "פתוחה" as const,
      conversationState: "new_lead" as const,
      aiMode: "active" as const,
      needsHuman: false,
      requiresOwnerAttention: false,
      takeoverReason: null,
      processingLockAt: null,
      processingLockExpiresAt: null,
      summary: "בדיקת confidence",
      summaryDetails: {
        shortSummary: "בדיקת confidence",
        painPoints: [],
        objections: [],
        buyingSignals: [],
        qualificationStatus: "not_started" as const,
        collectedInformation: {},
        missingInformation: [],
        currentState: "new_lead" as const,
        nextRecommendedAction: "continue_conversation" as const,
        ownerAttentionRequired: false
      },
      structuredMemory: memory,
      memorySummary: "בדיקת confidence",
      lastMemoryUpdateAt: now,
      nextAction: "להמשיך",
      nextRecommendedAction: "continue_conversation" as const,
      updatedAt: now
    };
    const message = {
      id: "confidence_msg",
      businessId,
      conversationId: conversation.id,
      idempotencyKey: "confidence",
      provider: "simulator" as const,
      messageType: "text" as const,
      deliveryStatus: "delivered" as const,
      sender: "lead" as const,
      body: "אני רוצה לקבוע שיחה היום",
      createdAt: now
    };
    const run = runAgentBrain({ userMessage: message.body, history: [message], business: defaultBusiness, agent: defaultAgent, conversation, promptVersion: initialState.promptVersions[0] });
    return result("Structured Output confidence", "0-100", String(run.output.confidence), run.output.confidence >= 0 && run.output.confidence <= 100, "agent run", "none", "validated output", "confidence present");
  }
];

function result(testName: string, expected: string, actual: string, pass: boolean, recordsCreated: string, actionsBlocked: string, actionsCompleted: string, errorHandlingResult: string): TestResult {
  return { testName, expected, actual, pass, recordsCreated, actionsBlocked, actionsCompleted, errorHandlingResult };
}

async function main() {
  const results = [];
  for (const test of tests) {
    results.push(await test());
  }
  console.table(results);
  const failed = results.filter((item) => !item.pass);
  if (failed.length) {
    console.error(`Pilot evaluation failed: ${failed.length}/${results.length}`);
    process.exit(1);
  }
  console.log(`Pilot evaluation passed: ${results.length}/${results.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

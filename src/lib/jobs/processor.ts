import { createAuditLog } from "@/lib/audit/audit-log";
import { runAgentBrain, summarizeConversation } from "@/lib/agent-brain/brain";
import { buildMemorySummary, updateMemory } from "@/lib/conversation/memory";
import { recommendAction } from "@/lib/actions/action-engine";
import { createOutboundDraft } from "@/lib/pilot/draft-service";
import { checkPilotCanRunAgent } from "@/lib/pilot/guards";
import { evaluateSendGate } from "@/lib/pilot/send-gate";
import { getPilotState, savePilotState } from "@/lib/pilot/server-store";
import type { AppState, Conversation, Lead, Message } from "@/lib/store/types";

function nowIso() {
  return new Date().toISOString();
}

function lockConversation(conversation: Conversation) {
  const now = new Date();
  return {
    ...conversation,
    processingLockAt: now.toISOString(),
    processingLockExpiresAt: new Date(now.getTime() + 120000).toISOString()
  };
}

function unlockConversation(conversation: Conversation) {
  return {
    ...conversation,
    processingLockAt: null,
    processingLockExpiresAt: null
  };
}

export function processPendingPilotJobs(limit = 10) {
  let state = getPilotState();
  const business = state.business;
  const agent = state.agent;
  const promptVersion = state.promptVersions.find((version) => version.status === "active") ?? state.promptVersions[0];
  if (!business || !agent || !promptVersion) return { processed: 0, blocked: 0, failed: 0 };

  let processed = 0;
  let blocked = 0;
  let failed = 0;
  const dueJobs = state.backgroundJobs
    .filter((job) => job.status === "pending" && new Date(job.scheduledFor).getTime() <= Date.now())
    .slice(0, limit);

  for (const job of dueJobs) {
    const batch = state.messageProcessingBatches.find((item) => item.id === job.entityId);
    if (!batch) {
      failed += 1;
      state = {
        ...state,
        backgroundJobs: state.backgroundJobs.map((item) => (item.id === job.id ? { ...item, status: "failed", failedAt: nowIso(), lastError: "batch not found" } : item))
      };
      continue;
    }
    const conversation = state.conversations.find((item) => item.id === batch.conversationId);
    const lead = conversation ? state.leads.find((item) => item.id === conversation.leadId) : undefined;
    if (!conversation || !lead) {
      failed += 1;
      state = {
        ...state,
        backgroundJobs: state.backgroundJobs.map((item) => (item.id === job.id ? { ...item, status: "failed", failedAt: nowIso(), lastError: "conversation or lead not found" } : item))
      };
      continue;
    }

    const guard = checkPilotCanRunAgent(business.pilotSettings, conversation);
    if (!guard.allowed) {
      blocked += 1;
      state = {
        ...state,
        backgroundJobs: state.backgroundJobs.map((item) => (item.id === job.id ? { ...item, status: "blocked", completedAt: nowIso(), lastError: guard.reason } : item)),
        conversations: state.conversations.map((item) => (item.id === conversation.id ? { ...item, requiresOwnerAttention: true, needsHuman: true, takeoverReason: guard.reason, aiMode: "waiting_for_owner" } : item)),
        auditLogs: [
          createAuditLog({
            businessId: business.id,
            actorType: "system",
            actorId: null,
            action: "agent_run_blocked",
            entityType: "background_job",
            entityId: job.id,
            result: "blocked",
            metadata: { reason: guard.reason }
          }),
          ...state.auditLogs
        ]
      };
      continue;
    }

    const lockedConversation = lockConversation(conversation);
    const batchMessages = state.messages
      .filter((message) => batch.messageIds.includes(message.id))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const groupedText = batchMessages.map((message) => message.body).join("\n");
    const userMessage: Message = batchMessages[batchMessages.length - 1];
    const run = runAgentBrain({
      userMessage: groupedText,
      history: state.messages.filter((message) => message.conversationId === conversation.id),
      business,
      agent,
      conversation: lockedConversation,
      promptVersion
    });
    const nextMemory = updateMemory(conversation.structuredMemory, run.output);
    const summaryDetails = summarizeConversation(conversation.summaryDetails, run.output, nextMemory);
    const updatedConversation: Conversation = unlockConversation({
      ...lockedConversation,
      lastMessage: run.reply,
      heat: run.heat,
      leadTemperature: run.output.lead_temperature,
      leadScore: run.output.lead_score,
      intentScore: run.output.intent_score,
      engagementScore: run.output.engagement_score,
      bookingProbability: run.output.booking_probability,
      status: run.status,
      conversationState: run.output.conversation_state,
      aiMode: run.output.requires_human_takeover ? "waiting_for_owner" : "active",
      needsHuman: run.output.requires_human_takeover,
      requiresOwnerAttention: run.output.requires_human_takeover,
      takeoverReason: run.output.takeover_reason,
      summary: run.internalSummary,
      summaryDetails,
      structuredMemory: nextMemory,
      memorySummary: buildMemorySummary(nextMemory),
      lastMemoryUpdateAt: nowIso(),
      nextAction: run.nextAction,
      nextRecommendedAction: run.output.next_recommended_action,
      lastAgentRunId: run.id,
      updatedAt: nowIso()
    });
    const updatedLead: Lead = {
      ...lead,
      status: run.status,
      heat: run.heat,
      leadTemperature: run.output.lead_temperature,
      leadScore: run.output.lead_score,
      intentScore: run.output.intent_score,
      engagementScore: run.output.engagement_score,
      bookingProbability: run.output.booking_probability,
      lastScoreReason: run.output.internal_notes,
      needSummary: run.internalSummary,
      nextAction: run.nextAction,
      nextRecommendedAction: run.output.next_recommended_action,
      updatedAt: nowIso()
    };
    const draft = createOutboundDraft({ businessId: business.id, lead: updatedLead, conversation: updatedConversation, agentRun: run, sourceMessageIds: batch.messageIds });
    const latestMessageIds = state.messages.filter((message) => message.conversationId === conversation.id && message.sender === "lead").map((message) => message.id);
    const sendGate = evaluateSendGate({ business, lead: updatedLead, conversation: updatedConversation, draft, latestMessageIds });
    const action = recommendAction({ businessId: business.id, conversation: updatedConversation, lead: updatedLead, output: run.output, now: nowIso() });

    state = updateProcessedState(state, {
      jobId: job.id,
      batchId: batch.id,
      conversation: updatedConversation,
      lead: updatedLead,
      run,
      draft: { ...draft, blockReason: sendGate.reason },
      action,
      userMessageId: userMessage.id
    });
    processed += 1;
  }

  savePilotState(state);
  return { processed, blocked, failed };
}

function updateProcessedState(
  state: AppState,
  input: {
    jobId: string;
    batchId: string;
    conversation: Conversation;
    lead: Lead;
    run: ReturnType<typeof runAgentBrain>;
    draft: AppState["outboundDrafts"][number];
    action: AppState["agentActions"][number];
    userMessageId: string;
  }
) {
  return {
    ...state,
    conversations: state.conversations.map((item) => (item.id === input.conversation.id ? input.conversation : item)),
    leads: state.leads.map((item) => (item.id === input.lead.id ? input.lead : item)),
    agentRuns: [input.run, ...state.agentRuns],
    outboundDrafts: [input.draft, ...state.outboundDrafts],
    agentActions: [input.action, ...state.agentActions],
    backgroundJobs: state.backgroundJobs.map((item) => (item.id === input.jobId ? { ...item, status: "completed" as const, startedAt: item.startedAt ?? nowIso(), completedAt: nowIso() } : item)),
    messageProcessingBatches: state.messageProcessingBatches.map((item) => (item.id === input.batchId ? { ...item, status: "completed" as const, agentRunId: input.run.id, processedAt: nowIso() } : item)),
    auditLogs: [
      createAuditLog({
        businessId: input.conversation.businessId,
        actorType: "ai",
        actorId: input.run.id,
        action: "draft_created",
        entityType: "outbound_draft",
        entityId: input.draft.id,
        result: "success",
        metadata: { sourceMessage: input.userMessageId, leadScore: input.run.output.lead_score }
      }),
      ...state.auditLogs
    ],
    notifications: [
      {
        id: `note_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        businessId: input.conversation.businessId,
        type: "draft_pending_approval" as const,
        title: "טיוטה ממתינה לאישור",
        body: input.draft.draftMessage,
        entityId: input.draft.id,
        read: false,
        createdAt: nowIso()
      },
      ...state.notifications
    ],
    pilotUsageCounters: {
      ...state.pilotUsageCounters,
      draftsCreated: state.pilotUsageCounters.draftsCreated + 1,
      hotLeadsDetected: input.run.output.lead_temperature === "hot" ? state.pilotUsageCounters.hotLeadsDetected + 1 : state.pilotUsageCounters.hotLeadsDetected,
      conversationsWaitingForOwner: input.run.output.requires_human_takeover ? state.pilotUsageCounters.conversationsWaitingForOwner + 1 : state.pilotUsageCounters.conversationsWaitingForOwner
    }
  };
}

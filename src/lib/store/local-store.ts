"use client";

import { initialState } from "./demo-data";
import type { AppState, Conversation, Lead, Message, StructuredMemory } from "./types";

const storageKey = "goldenflow-ai-assistant-state";

export function loadState(): AppState {
  if (typeof window === "undefined") {
    return initialState;
  }

  const stored = window.localStorage.getItem(storageKey);
  if (!stored) {
    return initialState;
  }

  try {
    return normalizeState(JSON.parse(stored) as Partial<AppState>);
  } catch {
    return initialState;
  }
}

export function saveState(state: AppState) {
  window.localStorage.setItem(storageKey, JSON.stringify(state));
}

export function resetState() {
  window.localStorage.removeItem(storageKey);
}

export function createEmptyMemory(): StructuredMemory {
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

function normalizeLead(lead: Lead): Lead {
  return {
    ...lead,
    normalizedPhone: lead.normalizedPhone ?? lead.phone.replace(/[^\d]/g, ""),
    leadTemperature: lead.leadTemperature ?? (lead.heat === "חם" ? "hot" : lead.heat === "בינוני" ? "warm" : "cold"),
    leadScore: lead.leadScore ?? 0,
    intentScore: lead.intentScore ?? 0,
    engagementScore: lead.engagementScore ?? 0,
    bookingProbability: lead.bookingProbability ?? 0,
    lastScoreReason: lead.lastScoreReason ?? "נתון קיים משלב קודם",
    nextRecommendedAction: lead.nextRecommendedAction ?? "continue_conversation",
    externalLeadId: lead.externalLeadId,
    doNotContact: lead.doNotContact ?? false,
    doNotContactAt: lead.doNotContactAt ?? null,
    optOutReason: lead.optOutReason ?? null
  };
}

function normalizeMessage(message: Message): Message {
  return {
    ...message,
    provider: message.provider ?? "simulator",
    messageType: message.messageType ?? "text",
    deliveryStatus: message.deliveryStatus ?? (message.sender === "agent" ? "sent" : "delivered"),
    idempotencyKey: message.idempotencyKey ?? `${message.businessId}:${message.conversationId}:${message.sender}:${message.body}`
  };
}

function normalizeConversation(conversation: Conversation): Conversation {
  const memory = conversation.structuredMemory ?? createEmptyMemory();
  return {
    ...conversation,
    leadTemperature: conversation.leadTemperature ?? (conversation.heat === "חם" ? "hot" : conversation.heat === "בינוני" ? "warm" : "cold"),
    leadScore: conversation.leadScore ?? 0,
    intentScore: conversation.intentScore ?? 0,
    engagementScore: conversation.engagementScore ?? 0,
    bookingProbability: conversation.bookingProbability ?? 0,
    conversationState: conversation.conversationState ?? "new_lead",
    aiMode: conversation.aiMode ?? "active",
    requiresOwnerAttention: conversation.requiresOwnerAttention ?? conversation.needsHuman ?? false,
    takeoverReason: conversation.takeoverReason ?? null,
    processingLockAt: conversation.processingLockAt ?? null,
    processingLockExpiresAt: conversation.processingLockExpiresAt ?? null,
    summaryDetails: conversation.summaryDetails ?? {
      shortSummary: conversation.summary,
      painPoints: [],
      objections: memory.objections,
      buyingSignals: memory.buying_signals,
      qualificationStatus: "not_started",
      collectedInformation: {},
      missingInformation: [],
      currentState: conversation.conversationState ?? "new_lead",
      nextRecommendedAction: conversation.nextRecommendedAction ?? "continue_conversation",
      ownerAttentionRequired: conversation.needsHuman
    },
    structuredMemory: memory,
    memorySummary: conversation.memorySummary ?? conversation.summary,
    lastMemoryUpdateAt: conversation.lastMemoryUpdateAt ?? null,
    nextRecommendedAction: conversation.nextRecommendedAction ?? "continue_conversation"
  };
}

function normalizeState(state: Partial<AppState>): AppState {
  return {
    ...initialState,
    ...state,
    business: state.business
      ? {
          ...initialState.business!,
          ...state.business,
          pilotSettings: {
            ...initialState.business!.pilotSettings,
            ...state.business.pilotSettings
          }
        }
      : initialState.business,
    agent: state.agent
      ? {
          ...initialState.agent!,
          ...state.agent,
          qualificationFields: state.agent.qualificationFields ?? initialState.agent!.qualificationFields
        }
      : initialState.agent,
    leads: (state.leads ?? []).map(normalizeLead),
    conversations: (state.conversations ?? []).map(normalizeConversation),
    messages: (state.messages ?? []).map(normalizeMessage),
    agentRuns: state.agentRuns ?? [],
    promptVersions: state.promptVersions ?? initialState.promptVersions,
    stateEvents: state.stateEvents ?? [],
    leadScoreEvents: state.leadScoreEvents ?? [],
    agentActions: state.agentActions ?? [],
    followUpQueue: state.followUpQueue ?? [],
    integrationEvents: state.integrationEvents ?? [],
    whatsappConnections: state.whatsappConnections ?? initialState.whatsappConnections,
    backgroundJobs: state.backgroundJobs ?? [],
    messageProcessingBatches: state.messageProcessingBatches ?? [],
    outboundDrafts: state.outboundDrafts ?? [],
    outboundMessageAttempts: state.outboundMessageAttempts ?? [],
    crmActions: state.crmActions ?? [],
    auditLogs: state.auditLogs ?? [],
    notifications: state.notifications ?? [],
    phoneAllowlist: state.phoneAllowlist ?? initialState.phoneAllowlist,
    pilotUsageCounters: {
      ...initialState.pilotUsageCounters,
      ...state.pilotUsageCounters
    }
  };
}

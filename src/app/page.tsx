"use client";

import { useEffect, useMemo, useState } from "react";
import { Flame, MessageCircle, Pause, Play, RefreshCcw, Send, ShieldCheck, UserCheck, XCircle } from "lucide-react";
import { Shell, type AppTab } from "@/components/shell";
import { EmptyState, Field, HeatBadge, Panel } from "@/components/ui";
import { runAgentBrain, summarizeConversation } from "@/lib/agent-brain/brain";
import { updateMemory, buildMemorySummary } from "@/lib/conversation/memory";
import { recommendAction } from "@/lib/actions/action-engine";
import { createFollowUpDraft } from "@/lib/actions/follow-up-engine";
import { businessId, defaultAgent, defaultBusiness, initialState } from "@/lib/store/demo-data";
import { createEmptyMemory, loadState, resetState, saveState } from "@/lib/store/local-store";
import type { Agent, AppState, AutomationLevel, Business, Conversation, ConversationState, Lead, Message, PilotSettings } from "@/lib/store/types";

const nowIso = () => new Date().toISOString();
const uid = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
const normalizePhone = (phone: string) => phone.replace(/[^\d]/g, "");
const makeIdempotencyKey = (business: string, phone: string, body: string) => `${business}:${normalizePhone(phone)}:${body.trim().toLowerCase()}`;

function formatTime(value: string) {
  return new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function stateLabel(state: ConversationState) {
  const labels: Record<ConversationState, string> = {
    new_lead: "ליד חדש",
    qualification: "סינון",
    warming_up: "חימום",
    objection_handling: "טיפול בהתנגדות",
    booking_ready: "מוכן לקביעה",
    follow_up_needed: "צריך פולואפ",
    waiting_for_user: "ממתין לליד",
    waiting_for_owner: "ממתין לבעל העסק",
    transferred_to_owner: "הועבר לבעל העסק",
    booked: "נקבע",
    closed_not_relevant: "לא רלוונטי",
    closed_by_owner: "נסגר על ידי בעל העסק"
  };
  return labels[state];
}

function temperatureLabel(temperature: "cold" | "warm" | "hot") {
  return temperature === "hot" ? "חם" : temperature === "warm" ? "בינוני" : "קר";
}

function createInitialSummary(state: ConversationState) {
  return {
    shortSummary: "שיחה חדשה מסימולטור.",
    painPoints: [],
    objections: [],
    buyingSignals: [],
    qualificationStatus: "not_started" as const,
    collectedInformation: {},
    missingInformation: [],
    currentState: state,
    nextRecommendedAction: "continue_conversation" as const,
    ownerAttentionRequired: false
  };
}

function AuthScreen({ onLogin }: { onLogin: (name: string, email: string) => void }) {
  const [name, setName] = useState("בעל העסק");
  const [email, setEmail] = useState("owner@goldenflow.local");

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-black/10 bg-white p-5 shadow-soft">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-gold">GoldenFlow AI Assistant</p>
        <h1 className="mt-2 text-3xl font-bold text-ink">עובד דיגיטלי ללידים ופולואפים</h1>
        <p className="mt-3 text-sm leading-6 text-black/65">
          MVP פנימי ונפרד לחלוטין מה-CRM. התחברות הדמו יוצרת סביבת עסק מבודדת עם `business_id`.
        </p>
        <div className="mt-5 grid gap-3">
          <Field label="שם" value={name} onChange={setName} />
          <Field label="אימייל" value={email} onChange={setEmail} />
          <button
            type="button"
            onClick={() => onLogin(name, email)}
            className="mt-2 flex h-11 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-bold text-white transition hover:bg-black"
          >
            <ShieldCheck size={18} />
            כניסה / הרשמה
          </button>
        </div>
      </section>
    </main>
  );
}

function SetupScreen({
  business,
  agent,
  onBusinessChange,
  onAgentChange
}: {
  business: Business;
  agent: Agent;
  onBusinessChange: (business: Business) => void;
  onAgentChange: (agent: Agent) => void;
}) {
  const updateBusiness = (key: keyof Business, value: string) => onBusinessChange({ ...business, [key]: value });
  const updateAgent = (key: keyof Agent, value: string) => onAgentChange({ ...agent, [key]: value });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="הגדרת עסק">
        <div className="grid gap-3">
          <Field label="שם העסק" value={business.name} onChange={(value) => updateBusiness("name", value)} />
          <Field label="תחום העסק" value={business.field} onChange={(value) => updateBusiness("field", value)} />
          <Field label="תיאור קצר" value={business.description} onChange={(value) => updateBusiness("description", value)} textarea />
          <Field label="קהל יעד" value={business.audience} onChange={(value) => updateBusiness("audience", value)} textarea />
          <Field label="שירותים" value={business.services} onChange={(value) => updateBusiness("services", value)} textarea />
          <Field label="טון דיבור" value={business.tone} onChange={(value) => updateBusiness("tone", value)} />
          <Field label="שעות פעילות" value={business.hours} onChange={(value) => updateBusiness("hours", value)} />
          <Field label="שאלות נפוצות" value={business.faqs} onChange={(value) => updateBusiness("faqs", value)} textarea />
          <Field label="מחירים (אופציונלי)" value={business.prices ?? ""} onChange={(value) => updateBusiness("prices", value)} />
          <Field label="מה אסור לסוכן להגיד" value={business.forbiddenTopics} onChange={(value) => updateBusiness("forbiddenTopics", value)} textarea />
          <label className="grid gap-1 text-sm font-semibold text-ink">
            מטרת השיחה
            <select
              className="rounded-md border border-black/10 bg-paper px-3 py-2 text-sm outline-none focus:border-gold"
              value={business.conversationGoal}
              onChange={(event) => updateBusiness("conversationGoal", event.target.value)}
            >
              <option>לקבוע שיחה</option>
              <option>לאסוף פרטים</option>
              <option>לסנן ליד</option>
              <option>לחמם ליד</option>
            </select>
          </label>
        </div>
      </Panel>

      <Panel title="הגדרת סוכן AI">
        <div className="grid gap-3">
          <Field label="שם הסוכן" value={agent.name} onChange={(value) => updateAgent("name", value)} />
          <Field label="תפקיד הסוכן" value={agent.role} onChange={(value) => updateAgent("role", value)} />
          <Field label="הודעת פתיחה" value={agent.openingMessage} onChange={(value) => updateAgent("openingMessage", value)} textarea />
          <Field label="שאלות סינון" value={agent.qualificationQuestions} onChange={(value) => updateAgent("qualificationQuestions", value)} textarea />
          <Field label="הוראות התנהגות" value={agent.behaviorInstructions} onChange={(value) => updateAgent("behaviorInstructions", value)} textarea />
          <Field label="מתי להעביר לבעל העסק" value={agent.handoffRules} onChange={(value) => updateAgent("handoffRules", value)} textarea />
          <Field label="איך לזהות ליד חם" value={agent.hotLeadRules} onChange={(value) => updateAgent("hotLeadRules", value)} textarea />
          <Field label="איך לזהות התנגדות" value={agent.objectionRules} onChange={(value) => updateAgent("objectionRules", value)} textarea />
          <Field label="איך לזהות חוסר התאמה" value={agent.disqualificationRules} onChange={(value) => updateAgent("disqualificationRules", value)} textarea />
        </div>
      </Panel>
    </div>
  );
}

function ChatSimulator({ state, setState }: { state: AppState; setState: (state: AppState) => void }) {
  const [leadName, setLeadName] = useState("דניאל כהן");
  const [leadPhone, setLeadPhone] = useState("050-1234567");
  const [draft, setDraft] = useState("היי, אני רוצה להבין איך אתם יכולים לעזור לי עם לידים");
  const conversation = state.conversations[0];
  const messages = conversation ? state.messages.filter((message) => message.conversationId === conversation.id) : [];

  function ensureConversation(): { conversation: Conversation; lead: Lead; nextState: AppState } {
    const normalizedPhone = normalizePhone(leadPhone);
    const existingLead = state.leads.find((item) => item.businessId === businessId && normalizePhone(item.phone) === normalizedPhone);
    const existingConversation = existingLead
      ? state.conversations.find((item) => item.businessId === businessId && item.leadId === existingLead.id)
      : conversation;

    if (existingConversation) {
      const lead = state.leads.find((item) => item.id === existingConversation.leadId) ?? existingLead ?? state.leads[0];
      return { conversation: existingConversation, lead, nextState: state };
    }

    const timestamp = nowIso();
    const lead: Lead = {
      id: uid("lead"),
      businessId,
      name: leadName,
      phone: leadPhone,
      normalizedPhone: normalizePhone(leadPhone),
      source: "Chat Simulator",
      status: "פתוחה",
      heat: "קר",
      leadTemperature: "cold",
      leadScore: 0,
      intentScore: 0,
      engagementScore: 0,
      bookingProbability: 0,
      lastScoreReason: "ליד חדש מסימולטור",
      needSummary: "נוצר מסימולטור הצ׳אט.",
      nextAction: "להתחיל שיחת סינון",
      nextRecommendedAction: "continue_conversation",
      followUpAt: timestamp,
      externalLeadId: `gfai_${normalizedPhone || uid("phone")}`,
      doNotContact: false,
      doNotContactAt: null,
      optOutReason: null,
      updatedAt: timestamp
    };
    const initialConversationState: ConversationState = "new_lead";
    const structuredMemory = {
      ...createEmptyMemory(),
      full_name: leadName,
      phone: leadPhone,
      lead_source: "Chat Simulator"
    };
    const newConversation: Conversation = {
      id: uid("conv"),
      businessId,
      leadId: lead.id,
      leadName,
      leadPhone,
      lastMessage: "",
      heat: "קר",
      leadTemperature: "cold",
      leadScore: 0,
      intentScore: 0,
      engagementScore: 0,
      bookingProbability: 0,
      status: "פתוחה",
      conversationState: initialConversationState,
      aiMode: "active",
      needsHuman: false,
      requiresOwnerAttention: false,
      takeoverReason: null,
      processingLockAt: null,
      processingLockExpiresAt: null,
      summary: "שיחה חדשה מסימולטור.",
      summaryDetails: createInitialSummary(initialConversationState),
      structuredMemory,
      memorySummary: buildMemorySummary(structuredMemory),
      lastMemoryUpdateAt: timestamp,
      nextAction: "להתחיל שיחת סינון",
      nextRecommendedAction: "continue_conversation",
      externalConversationId: `conv_${lead.id}`,
      updatedAt: timestamp
    };
    return {
      conversation: newConversation,
      lead,
      nextState: { ...state, leads: [lead, ...state.leads], conversations: [newConversation, ...state.conversations] }
    };
  }

  function sendMessage() {
    if (!draft.trim() || !state.business || !state.agent) return;
    const base = ensureConversation();
    const timestamp = nowIso();
    const idempotencyKey = makeIdempotencyKey(businessId, base.lead.phone, draft);
    const duplicateMessage = base.nextState.messages.some((message) => message.idempotencyKey === idempotencyKey);
    if (duplicateMessage) {
      setDraft("");
      return;
    }
    const userMessage: Message = {
      id: uid("msg"),
      conversationId: base.conversation.id,
      businessId,
      idempotencyKey,
      provider: "simulator",
      messageType: "text",
      deliveryStatus: "delivered",
      sender: "lead",
      body: draft.trim(),
      createdAt: timestamp
    };
    if (base.conversation.aiMode !== "active" && base.conversation.aiMode !== "resumed") {
      const updatedConversation: Conversation = {
        ...base.conversation,
        lastMessage: userMessage.body,
        status: "דורשת טיפול",
        conversationState: base.conversation.aiMode === "paused_by_owner" ? "transferred_to_owner" : "waiting_for_owner",
        needsHuman: true,
        requiresOwnerAttention: true,
        takeoverReason: "AI paused; message saved for owner",
        nextAction: "בעל העסק צריך לענות ידנית",
        nextRecommendedAction: "owner_follow_up",
        updatedAt: timestamp
      };
      setState({
        ...base.nextState,
        messages: [...base.nextState.messages, userMessage],
        conversations: base.nextState.conversations.map((item) => (item.id === updatedConversation.id ? updatedConversation : item))
      });
      setDraft("");
      return;
    }
    const activePromptVersion =
      state.promptVersions.find((version) => version.aiAgentId === state.agent?.id && version.status === "active") ?? state.promptVersions[0];
    const run = runAgentBrain({
      userMessage: draft,
      history: [...messages, userMessage],
      business: state.business,
      agent: state.agent,
      conversation: base.conversation,
      promptVersion: activePromptVersion
    });
    const nextMemory = updateMemory(base.conversation.structuredMemory, run.output);
    const nextSummaryDetails = summarizeConversation(base.conversation.summaryDetails, run.output, nextMemory);
    const agentMessage: Message = {
      id: uid("msg"),
      conversationId: base.conversation.id,
      businessId,
      idempotencyKey: `${idempotencyKey}:agent`,
      provider: "simulator",
      messageType: "text",
      deliveryStatus: "sent",
      sender: "agent",
      body: run.reply,
      createdAt: nowIso()
    };
    const updatedConversation: Conversation = {
      ...base.conversation,
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
      needsHuman: run.needsHuman,
      requiresOwnerAttention: run.output.requires_human_takeover,
      takeoverReason: run.output.takeover_reason,
      summary: run.internalSummary,
      summaryDetails: nextSummaryDetails,
      structuredMemory: nextMemory,
      memorySummary: buildMemorySummary(nextMemory),
      lastMemoryUpdateAt: nowIso(),
      nextAction: run.nextAction,
      nextRecommendedAction: run.output.next_recommended_action,
      lastAgentRunId: run.id,
      updatedAt: nowIso()
    };
    const updatedLead: Lead = {
      ...base.lead,
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
      followUpAt: nowIso(),
      updatedAt: nowIso()
    };
    const stateEvent =
      base.conversation.conversationState !== updatedConversation.conversationState
        ? {
            id: uid("state"),
            businessId,
            conversationId: updatedConversation.id,
            previousState: base.conversation.conversationState,
            newState: updatedConversation.conversationState,
            reason: run.output.internal_notes,
            agentRunId: run.id,
            createdAt: nowIso()
          }
        : null;
    const scoreEvent =
      base.lead.leadScore !== updatedLead.leadScore
        ? {
            id: uid("score"),
            businessId,
            leadId: updatedLead.id,
            previousScore: base.lead.leadScore,
            newScore: updatedLead.leadScore,
            reason: run.output.internal_notes,
            agentRunId: run.id,
            createdAt: nowIso()
          }
        : null;
    const action = recommendAction({ businessId, conversation: updatedConversation, lead: updatedLead, output: run.output, now: nowIso() });
    const followUpDraft = createFollowUpDraft({
      businessId,
      conversation: updatedConversation,
      lead: updatedLead,
      output: run.output,
      now: nowIso(),
      existingDrafts: base.nextState.followUpQueue
    });
    setState({
      ...base.nextState,
      agentRuns: [run, ...base.nextState.agentRuns],
      messages: [...base.nextState.messages, userMessage, agentMessage],
      conversations: base.nextState.conversations.map((item) => (item.id === updatedConversation.id ? updatedConversation : item)),
      leads: base.nextState.leads.map((item) => (item.id === updatedLead.id ? updatedLead : item)),
      stateEvents: stateEvent ? [stateEvent, ...base.nextState.stateEvents] : base.nextState.stateEvents,
      leadScoreEvents: scoreEvent ? [scoreEvent, ...base.nextState.leadScoreEvents] : base.nextState.leadScoreEvents,
      agentActions: [action, ...base.nextState.agentActions],
      followUpQueue: followUpDraft ? [followUpDraft, ...base.nextState.followUpQueue] : base.nextState.followUpQueue
    });
    setDraft("");
  }

  function markHot() {
    if (!conversation) return;
    setState({
      ...state,
      conversations: state.conversations.map((item) =>
        item.id === conversation.id
          ? {
              ...item,
              heat: "חם",
              leadTemperature: "hot",
              leadScore: Math.max(item.leadScore, 80),
              status: "דורשת טיפול",
              conversationState: "waiting_for_owner",
              aiMode: "waiting_for_owner",
              needsHuman: true,
              requiresOwnerAttention: true,
              takeoverReason: "סומן ידנית כליד חם",
              nextAction: "חזרה מיידית לליד",
              nextRecommendedAction: "owner_follow_up"
            }
          : item
      ),
      leads: state.leads.map((item) =>
        item.id === conversation.leadId
          ? {
              ...item,
              heat: "חם",
              leadTemperature: "hot",
              leadScore: Math.max(item.leadScore, 80),
              status: "דורשת טיפול",
              nextAction: "חזרה מיידית לליד",
              nextRecommendedAction: "owner_follow_up",
              lastScoreReason: "סומן ידנית כליד חם"
            }
          : item
      )
    });
  }

  function takeOver() {
    if (!conversation) return;
    setState({
      ...state,
      conversations: state.conversations.map((item) =>
        item.id === conversation.id
          ? {
              ...item,
              status: "דורשת טיפול",
              conversationState: "transferred_to_owner",
              aiMode: "paused_by_owner",
              needsHuman: true,
              requiresOwnerAttention: true,
              takeoverReason: "בעל העסק לקח שליטה",
              nextAction: "בעל העסק לקח שליטה",
              nextRecommendedAction: "owner_follow_up"
            }
          : item
      ),
      leads: state.leads.map((item) =>
        item.id === conversation.leadId ? { ...item, status: "דורשת טיפול", nextAction: "בעל העסק לקח שליטה", nextRecommendedAction: "owner_follow_up" } : item
      )
    });
  }

  function updateAiMode(mode: Conversation["aiMode"], nextState: ConversationState, reason: string) {
    if (!conversation) return;
    setState({
      ...state,
      conversations: state.conversations.map((item) =>
        item.id === conversation.id
          ? {
              ...item,
              aiMode: mode,
              conversationState: nextState,
              status: mode === "active" || mode === "resumed" ? "פתוחה" : "דורשת טיפול",
              needsHuman: mode !== "active" && mode !== "resumed",
              requiresOwnerAttention: mode !== "active" && mode !== "resumed",
              takeoverReason: mode === "active" || mode === "resumed" ? null : reason,
              nextAction: mode === "active" || mode === "resumed" ? "AI חזר לשיחה" : reason
            }
          : item
      )
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)]">
      <Panel
        title="Chat Simulator"
        action={
          <button
            type="button"
            onClick={() =>
              setState({
                ...state,
                leads: [],
                conversations: [],
                messages: [],
                agentRuns: [],
                stateEvents: [],
                leadScoreEvents: [],
                agentActions: [],
                followUpQueue: [],
                integrationEvents: []
              })
            }
            className="flex h-9 items-center gap-2 rounded-md border border-black/10 px-3 text-sm font-bold hover:border-gold"
          >
            <RefreshCcw size={16} />
            Reset
          </button>
        }
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <Field label="שם ליד" value={leadName} onChange={setLeadName} />
          <Field label="טלפון" value={leadPhone} onChange={setLeadPhone} />
        </div>
        <div className="h-[460px] overflow-y-auto rounded-lg bg-[#efe9dc] p-4">
          {messages.length === 0 ? (
            <div className="grid h-full place-items-center text-center text-sm font-semibold text-black/55">
              שלחו הודעת ליד ראשונה כדי להפעיל את הסוכן.
            </div>
          ) : (
            <div className="grid gap-3">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.sender === "lead" ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-[78%] rounded-lg px-3 py-2 text-sm shadow-sm ${message.sender === "lead" ? "bg-white" : "bg-mint/80"}`}>
                    <p className="leading-6">{message.body}</p>
                    <p className="mt-1 text-left text-[11px] text-black/45">{formatTime(message.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="mt-4 flex gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") sendMessage();
            }}
            className="h-11 min-w-0 flex-1 rounded-md border border-black/10 bg-paper px-3 text-sm outline-none focus:border-gold"
            placeholder="כתבו הודעה בשם הליד"
          />
          <button type="button" onClick={sendMessage} className="flex h-11 items-center gap-2 rounded-md bg-ink px-4 text-sm font-bold text-white">
            <Send size={18} />
            שליחה
          </button>
        </div>
      </Panel>

      <Panel title="סטטוס ליד">
        {conversation ? (
          <div className="grid gap-4">
            <div className="flex items-center justify-between rounded-md bg-paper p-3">
              <span className="text-sm font-bold">רמת חום</span>
              <HeatBadge heat={conversation.heat} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md bg-paper p-3">
                <p className="text-xs font-bold text-black/50">Lead Score</p>
                <p className="mt-1 text-2xl font-bold">{conversation.leadScore}</p>
              </div>
              <div className="rounded-md bg-paper p-3">
                <p className="text-xs font-bold text-black/50">Intent</p>
                <p className="mt-1 text-sm font-bold">{state.agentRuns[0]?.output.detected_intent ?? "לא זוהה"}</p>
              </div>
            </div>
            <div className="rounded-md bg-paper p-3">
              <p className="text-xs font-bold text-black/50">Conversation State</p>
              <p className="mt-1 font-bold">{stateLabel(conversation.conversationState)}</p>
              <p className="mt-1 text-xs text-black/50">AI Mode: {conversation.aiMode}</p>
            </div>
            <div className="rounded-md bg-paper p-3">
              <p className="text-xs font-bold text-black/50">סיכום פנימי</p>
              <p className="mt-1 text-sm leading-6">{conversation.memorySummary}</p>
            </div>
            <div className="rounded-md bg-paper p-3">
              <p className="text-xs font-bold text-black/50">Collected / Missing</p>
              <p className="mt-1 text-sm leading-6">נאסף: {Object.keys(conversation.structuredMemory).filter((key) => !["asked_questions", "answered_questions", "objections", "buying_signals"].includes(key)).length}</p>
              <p className="text-sm leading-6">חסר: {conversation.summaryDetails.missingInformation.join(", ") || "אין כרגע"}</p>
            </div>
            <div className="rounded-md bg-paper p-3">
              <p className="text-xs font-bold text-black/50">פעולה הבאה</p>
              <p className="mt-1 text-sm font-bold leading-6">{conversation.nextAction}</p>
              {conversation.takeoverReason ? <p className="mt-1 text-xs text-amber-800">{conversation.takeoverReason}</p> : null}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <button type="button" onClick={takeOver} className="flex h-10 items-center justify-center gap-2 rounded-md border border-black/10 text-sm font-bold hover:border-gold">
                <UserCheck size={17} />
                Take Over
              </button>
              <button
                type="button"
                onClick={() => updateAiMode("paused_by_owner", "transferred_to_owner", "AI paused by owner")}
                className="flex h-10 items-center justify-center gap-2 rounded-md border border-black/10 text-sm font-bold hover:border-gold"
              >
                <Pause size={17} />
                Pause AI
              </button>
              <button
                type="button"
                onClick={() => updateAiMode("active", "qualification", "AI resumed by owner")}
                className="flex h-10 items-center justify-center gap-2 rounded-md border border-black/10 text-sm font-bold hover:border-gold"
              >
                <Play size={17} />
                Resume AI
              </button>
              <button type="button" onClick={markHot} className="flex h-10 items-center justify-center gap-2 rounded-md bg-gold/20 text-sm font-bold text-amber-900">
                <Flame size={17} />
                Mark Hot
              </button>
              <button
                type="button"
                onClick={() => updateAiMode("disabled", "closed_by_owner", "השיחה נסגרה על ידי בעל העסק")}
                className="flex h-10 items-center justify-center gap-2 rounded-md bg-black/5 text-sm font-bold text-ink"
              >
                <XCircle size={17} />
                Close
              </button>
            </div>
          </div>
        ) : (
          <EmptyState text="אין עדיין שיחה פעילה." />
        )}
      </Panel>
    </div>
  );
}

function Dashboard({ state }: { state: AppState }) {
  const hotLeads = state.leads.filter((lead) => lead.leadTemperature === "hot");
  const needsCare = state.conversations.filter((conversation) => conversation.needsHuman);
  const followUps = state.followUpQueue.filter((item) => item.status === "recommended");
  const bookingReady = state.conversations.filter((conversation) => conversation.conversationState === "booking_ready");
  const failedRuns = state.agentRuns.filter((run) => !run.success);
  const stats = [
    { label: "לידים חדשים", value: state.leads.length },
    { label: "לידים חמים", value: hotLeads.length },
    { label: "ממתינים לבעל העסק", value: needsCare.length },
    { label: "פולואפים מומלצים", value: followUps.length }
  ];

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <section key={stat.label} className="rounded-lg border border-black/10 bg-white p-4 shadow-soft">
            <p className="text-sm font-bold text-black/55">{stat.label}</p>
            <p className="mt-3 text-4xl font-bold text-ink">{stat.value}</p>
          </section>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="פעילות אחרונה">
          {state.conversations.length ? (
            <div className="grid gap-2">
              {state.conversations.slice(0, 5).map((conversation) => (
                <div key={conversation.id} className="flex items-center justify-between rounded-md bg-paper p-3">
                  <div>
                    <p className="font-bold">{conversation.leadName}</p>
                    <p className="text-sm text-black/60">{conversation.lastMessage || "שיחה חדשה"}</p>
                  </div>
                  <HeatBadge heat={conversation.heat} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="עדיין אין פעילות. התחילו מהסימולטור." />
          )}
        </Panel>
        <Panel title="למי לחזור היום">
          {needsCare.length ? (
            <div className="grid gap-2">
              {needsCare.map((conversation) => (
                <div key={conversation.id} className="rounded-md bg-mint/15 p-3">
                  <p className="font-bold">{conversation.leadName}</p>
                  <p className="text-sm leading-6 text-black/65">{conversation.nextAction}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="אין כרגע שיחות שדורשות טיפול." />
          )}
        </Panel>
        <Panel title="קרובים לקביעת שיחה">
          {bookingReady.length ? (
            <div className="grid gap-2">
              {bookingReady.map((conversation) => (
                <div key={conversation.id} className="rounded-md bg-gold/15 p-3">
                  <p className="font-bold">{conversation.leadName}</p>
                  <p className="text-sm leading-6 text-black/65">Score {conversation.leadScore} · {conversation.nextAction}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="אין כרגע לידים שמוכנים לקביעה." />
          )}
        </Panel>
        <Panel title="פעילות AI אחרונה">
          {state.agentRuns.length ? (
            <div className="grid gap-2">
              {state.agentRuns.slice(0, 5).map((run) => (
                <div key={run.id} className="rounded-md bg-paper p-3">
                  <p className="font-bold">{run.success ? "הרצה תקינה" : "הרצה נכשלה"} · {run.latencyMs}ms</p>
                  <p className="text-sm text-black/60">{run.output.detected_intent} · score {run.output.lead_score}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="אין עדיין הרצות AI." />
          )}
          {failedRuns.length ? <p className="mt-3 text-sm font-bold text-red-700">כשלים אחרונים: {failedRuns.length}</p> : null}
        </Panel>
      </div>
    </div>
  );
}

function DataTable({ type, state }: { type: "conversations" | "leads"; state: AppState }) {
  const [stateFilter, setStateFilter] = useState("all");
  const [temperatureFilter, setTemperatureFilter] = useState("all");
  const rows = type === "conversations" ? state.conversations : state.leads;
  const filteredRows = rows.filter((row) => {
    const rowState = "conversationState" in row ? row.conversationState : row.status;
    const matchesState = stateFilter === "all" || rowState === stateFilter;
    const matchesTemperature = temperatureFilter === "all" || row.leadTemperature === temperatureFilter;
    return matchesState && matchesTemperature;
  });
  return (
    <Panel
      title={type === "conversations" ? "Conversations" : "Leads"}
      action={
        <div className="flex gap-2">
          <select className="rounded-md border border-black/10 bg-white px-2 py-1 text-sm" value={temperatureFilter} onChange={(event) => setTemperatureFilter(event.target.value)}>
            <option value="all">כל החומים</option>
            <option value="hot">חם</option>
            <option value="warm">בינוני</option>
            <option value="cold">קר</option>
          </select>
          {type === "conversations" ? (
            <select className="rounded-md border border-black/10 bg-white px-2 py-1 text-sm" value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}>
              <option value="all">כל המצבים</option>
              <option value="qualification">סינון</option>
              <option value="booking_ready">מוכן לקביעה</option>
              <option value="waiting_for_owner">ממתין לבעל העסק</option>
              <option value="transferred_to_owner">הועבר לבעל העסק</option>
              <option value="closed_not_relevant">לא רלוונטי</option>
            </select>
          ) : null}
        </div>
      }
    >
      {filteredRows.length === 0 ? (
        <EmptyState text="אין נתונים עדיין. שלחו הודעה בסימולטור כדי ליצור ליד ושיחה." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-right text-sm">
            <thead className="text-xs text-black/50">
              <tr>
                <th className="px-3 py-2">שם</th>
                <th className="px-3 py-2">טלפון</th>
                <th className="px-3 py-2">State</th>
                <th className="px-3 py-2">חום</th>
                <th className="px-3 py-2">Score</th>
                <th className="px-3 py-2">סיכום / הודעה אחרונה</th>
                <th className="px-3 py-2">פעולה הבאה</th>
                <th className="px-3 py-2">עודכן</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const isConversation = "leadName" in row;
                return (
                  <tr key={row.id} className="bg-white shadow-sm">
                    <td className="rounded-r-md px-3 py-3 font-bold">{isConversation ? row.leadName : row.name}</td>
                    <td className="px-3 py-3">{isConversation ? row.leadPhone : row.phone}</td>
                    <td className="px-3 py-3">{isConversation ? stateLabel(row.conversationState) : row.status}</td>
                    <td className="px-3 py-3">{temperatureLabel(row.leadTemperature)}</td>
                    <td className="px-3 py-3 font-bold">{row.leadScore}</td>
                    <td className="max-w-xs px-3 py-3 text-black/65">{isConversation ? row.lastMessage : row.needSummary}</td>
                    <td className="px-3 py-3 font-semibold">{row.nextAction}</td>
                    <td className="rounded-l-md px-3 py-3">{formatTime(row.updatedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function FollowUpQueue({ state, setState }: { state: AppState; setState: (state: AppState) => void }) {
  function cancelDraft(id: string) {
    setState({
      ...state,
      followUpQueue: state.followUpQueue.map((draft) => (draft.id === id ? { ...draft, status: "cancelled", updatedAt: nowIso() } : draft))
    });
  }

  return (
    <Panel title="Follow-Up Queue">
      {state.followUpQueue.length === 0 ? (
        <EmptyState text="אין עדיין טיוטות פולואפ. המערכת תיצור המלצות רק בלי לשלוח הודעות בפועל." />
      ) : (
        <div className="grid gap-3">
          {state.followUpQueue.map((draft) => (
            <div key={draft.id} className="rounded-lg border border-black/10 bg-paper p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-bold">{draft.status}</p>
                <p className="text-sm text-black/60">{new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "short" }).format(new Date(draft.scheduledFor))}</p>
              </div>
              <p className="mt-3 text-sm leading-6">{draft.draftMessage}</p>
              <p className="mt-2 text-xs font-bold text-black/50">סיבה: {draft.reason}</p>
              {draft.status !== "cancelled" ? (
                <button type="button" onClick={() => cancelDraft(draft.id)} className="mt-3 rounded-md border border-black/10 px-3 py-2 text-sm font-bold hover:border-gold">
                  ביטול טיוטה
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function ControlCenter({ state, setState }: { state: AppState; setState: (state: AppState) => void }) {
  const business = state.business ?? defaultBusiness;
  const settings = business.pilotSettings;
  const connection = state.whatsappConnections[0];
  const pendingDrafts = state.outboundDrafts.filter((draft) => draft.status === "pending_approval");
  const ownerAttention = state.conversations.filter((conversation) => conversation.requiresOwnerAttention);
  const crmBlocked = state.crmActions.filter((action) => action.status === "blocked").length;
  const crmPending = state.crmActions.filter((action) => action.status === "pending").length;

  function updateSettings(next: Partial<PilotSettings>) {
    setState({
      ...state,
      business: {
        ...business,
        pilotSettings: {
          ...settings,
          ...next
        }
      },
      auditLogs: [
        {
          id: uid("audit"),
          businessId: business.id,
          actorType: "user",
          actorId: state.currentUser?.id ?? "owner_demo",
          action: "pilot_settings_changed",
          entityType: "business",
          entityId: business.id,
          result: "success",
          metadata: next as Record<string, string | number | boolean | null>,
          createdAt: nowIso()
        },
        ...state.auditLogs
      ]
    });
  }

  function rejectDraft(id: string) {
    setState({
      ...state,
      outboundDrafts: state.outboundDrafts.map((draft) => (draft.id === id ? { ...draft, status: "rejected", updatedAt: nowIso() } : draft)),
      pilotUsageCounters: {
        ...state.pilotUsageCounters,
        draftsRejected: state.pilotUsageCounters.draftsRejected + 1
      }
    });
  }

  function approveDraftLocally(id: string) {
    const draft = state.outboundDrafts.find((item) => item.id === id);
    const conversation = draft ? state.conversations.find((item) => item.id === draft.conversationId) : null;
    const lead = draft ? state.leads.find((item) => item.id === draft.leadId) : null;
    const blocked = !settings.whatsappSendingEnabled || !settings.pilotEnabled || lead?.doNotContact || conversation?.aiMode === "paused_by_owner";
    setState({
      ...state,
      outboundDrafts: state.outboundDrafts.map((item) =>
        item.id === id
          ? {
              ...item,
              status: blocked ? "blocked" : "approved",
              blockReason: blocked ? "Server-side send gate would block this draft with current pilot settings" : null,
              approvedBy: state.currentUser?.id ?? "owner_demo",
              approvedAt: blocked ? null : nowIso(),
              updatedAt: nowIso()
            }
          : item
      ),
      auditLogs: [
        {
          id: uid("audit"),
          businessId: business.id,
          actorType: "user",
          actorId: state.currentUser?.id ?? "owner_demo",
          action: blocked ? "draft_approval_blocked" : "draft_approved_locally",
          entityType: "outbound_draft",
          entityId: id,
          result: blocked ? "blocked" : "success",
          metadata: { whatsappSendingEnabled: settings.whatsappSendingEnabled, pilotEnabled: settings.pilotEnabled },
          createdAt: nowIso()
        },
        ...state.auditLogs
      ],
      pilotUsageCounters: {
        ...state.pilotUsageCounters,
        draftsApproved: blocked ? state.pilotUsageCounters.draftsApproved : state.pilotUsageCounters.draftsApproved + 1
      }
    });
  }

  function editDraft(id: string, text: string) {
    setState({
      ...state,
      outboundDrafts: state.outboundDrafts.map((draft) =>
        draft.id === id ? { ...draft, draftMessage: text, status: "edited", editedAt: nowIso(), updatedAt: nowIso() } : draft
      ),
      pilotUsageCounters: {
        ...state.pilotUsageCounters,
        draftsEdited: state.pilotUsageCounters.draftsEdited + 1
      }
    });
  }

  function toggle(label: string, value: boolean, onChange: (value: boolean) => void) {
    return (
      <label className="flex items-center justify-between gap-3 rounded-md bg-paper p-3 text-sm font-bold">
        {label}
        <input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} />
      </label>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Pilot Status">
          <div className="grid gap-2">
            {toggle("Pilot Enabled", settings.pilotEnabled, (value) => updateSettings({ pilotEnabled: value }))}
            {toggle("Agent Brain", settings.agentEnabled, (value) => updateSettings({ agentEnabled: value }))}
            {toggle("WhatsApp Receiving", settings.whatsappReceivingEnabled, (value) => updateSettings({ whatsappReceivingEnabled: value }))}
            {toggle("WhatsApp Sending", settings.whatsappSendingEnabled, (value) => updateSettings({ whatsappSendingEnabled: value }))}
            {toggle("CRM Sync", settings.crmSyncEnabled, (value) => updateSettings({ crmSyncEnabled: value }))}
            {toggle("Phone Allowlist", settings.phoneAllowlistEnabled, (value) => updateSettings({ phoneAllowlistEnabled: value }))}
            <label className="grid gap-1 rounded-md bg-paper p-3 text-sm font-bold">
              Automation Level
              <select
                className="rounded-md border border-black/10 bg-white px-2 py-2"
                value={settings.automationLevel}
                onChange={(event) => updateSettings({ automationLevel: event.target.value as AutomationLevel })}
              >
                <option value="off">Off</option>
                <option value="draft_only">Draft Only</option>
                <option value="safe_auto_reply">Safe Auto Reply</option>
                <option value="full_qualification">Full Qualification</option>
                <option value="follow_up_automation">Follow-Up Automation</option>
              </select>
            </label>
          </div>
        </Panel>
        <Panel title="WhatsApp Connection">
          <div className="grid gap-3 text-sm">
            <p><strong>סטטוס:</strong> {connection?.status ?? "not_configured"}</p>
            <p><strong>ספק:</strong> {connection?.provider ?? "mock_whatsapp"}</p>
            <p><strong>Webhook אחרון:</strong> {connection?.lastWebhookAt ? formatTime(connection.lastWebhookAt) : "אין"}</p>
            <p><strong>שליחה אחרונה:</strong> {connection?.lastSendAt ? formatTime(connection.lastSendAt) : "אין"}</p>
            <p><strong>שגיאה אחרונה:</strong> {connection?.lastError ?? "אין"}</p>
          </div>
        </Panel>
        <Panel title="GoldenFlow CRM">
          <div className="grid gap-3 text-sm">
            <p><strong>מצב:</strong> Mock / Contract Ready</p>
            <p><strong>פעולות ממתינות:</strong> {crmPending}</p>
            <p><strong>פעולות חסומות:</strong> {crmBlocked}</p>
            <p><strong>Kill Switch:</strong> {settings.crmSyncEnabled ? "פתוח" : "סגור"}</p>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Pending Approvals">
          {pendingDrafts.length ? (
            <div className="grid gap-3">
              {pendingDrafts.map((draft) => (
                <div key={draft.id} className="rounded-lg border border-black/10 bg-paper p-3">
                  <p className="text-xs font-bold text-black/50">Confidence {draft.confidence} · {draft.blockReason ?? "Draft Only"}</p>
                  <textarea
                    className="mt-2 min-h-24 w-full rounded-md border border-black/10 bg-white p-2 text-sm"
                    value={draft.draftMessage}
                    onChange={(event) => editDraft(draft.id, event.target.value)}
                  />
                  <div className="mt-2 flex gap-2">
                    <button type="button" className="rounded-md bg-ink px-3 py-2 text-sm font-bold text-white" onClick={() => approveDraftLocally(draft.id)}>אישור</button>
                    <button type="button" className="rounded-md border border-black/10 px-3 py-2 text-sm font-bold" onClick={() => rejectDraft(draft.id)}>דחייה</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="אין טיוטות שממתינות לאישור." />
          )}
        </Panel>
        <Panel title="Owner Attention">
          {ownerAttention.length ? (
            <div className="grid gap-2">
              {ownerAttention.map((conversation) => (
                <div key={conversation.id} className="rounded-md bg-gold/15 p-3">
                  <p className="font-bold">{conversation.leadName}</p>
                  <p className="text-sm text-black/65">{conversation.takeoverReason ?? conversation.nextAction}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="אין כרגע שיחות שממתינות לבעל העסק." />
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Metrics">
          <div className="grid gap-2 text-sm">
            <p>Incoming: {state.pilotUsageCounters.incomingMessagesCount}</p>
            <p>Outgoing: {state.pilotUsageCounters.outgoingMessagesCount}</p>
            <p>Drafts: {state.pilotUsageCounters.draftsCreated}</p>
            <p>Duplicates Ignored: {state.pilotUsageCounters.duplicateEventsIgnored}</p>
            <p>Opt-outs: {state.pilotUsageCounters.optOutCount}</p>
          </div>
        </Panel>
        <Panel title="Notifications">
          {state.notifications.length ? (
            <div className="grid gap-2">
              {state.notifications.slice(0, 5).map((notification) => (
                <div key={notification.id} className="rounded-md bg-paper p-3">
                  <p className="font-bold">{notification.title}</p>
                  <p className="text-sm text-black/60">{notification.body}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="אין התראות." />
          )}
        </Panel>
        <Panel title="Audit Log">
          {state.auditLogs.length ? (
            <div className="grid gap-2">
              {state.auditLogs.slice(0, 6).map((log) => (
                <div key={log.id} className="rounded-md bg-paper p-3 text-sm">
                  <p className="font-bold">{log.action}</p>
                  <p className="text-black/60">{log.result} · {formatTime(log.createdAt)}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="אין עדיין audit logs." />
          )}
        </Panel>
      </div>
    </div>
  );
}

export default function Home() {
  const [state, setStateValue] = useState<AppState>(initialState);
  const [activeTab, setActiveTab] = useState<AppTab>("setup");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setStateValue(loadState());
    setIsLoaded(true);
  }, []);

  const setState = (nextState: AppState) => {
    setStateValue(nextState);
    saveState(nextState);
  };

  const business = state.business ?? defaultBusiness;
  const agent = state.agent ?? defaultAgent;
  const content = useMemo(() => {
    if (activeTab === "setup") {
      return (
        <SetupScreen
          business={business}
          agent={agent}
          onBusinessChange={(nextBusiness) => setState({ ...state, business: nextBusiness })}
          onAgentChange={(nextAgent) => setState({ ...state, agent: nextAgent })}
        />
      );
    }
    if (activeTab === "simulator") return <ChatSimulator state={{ ...state, business, agent }} setState={setState} />;
    if (activeTab === "dashboard") return <Dashboard state={state} />;
    if (activeTab === "conversations") return <DataTable type="conversations" state={state} />;
    if (activeTab === "followups") return <FollowUpQueue state={state} setState={setState} />;
    if (activeTab === "control") return <ControlCenter state={state} setState={setState} />;
    return <DataTable type="leads" state={state} />;
  }, [activeTab, agent, business, state]);

  if (!isLoaded) {
    return null;
  }

  if (!state.currentUser) {
    return (
      <AuthScreen
        onLogin={(name, email) =>
          setState({
            ...initialState,
            currentUser: { id: uid("user"), name, email }
          })
        }
      />
    );
  }

  return (
    <Shell
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onLogout={() => {
        resetState();
        setStateValue({ ...initialState, currentUser: null });
      }}
    >
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-bold text-gold">{business.name}</p>
          <h2 className="text-2xl font-bold text-ink">ניהול שיחות AI ללידים</h2>
          <p className="mt-1 text-sm text-black/60">סביבת MVP מבודדת לפי business_id, ללא חיבור CRM או WhatsApp אמיתיים.</p>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-black/10 bg-white px-3 py-2 text-sm font-bold text-black/65">
          <MessageCircle size={17} />
          {agent.name} פעיל
        </div>
      </div>
      {content}
    </Shell>
  );
}

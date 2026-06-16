import type { Agent, AppState, Business } from "./types";

export const businessId = "biz_demo_goldenflow_assistant";

export const defaultBusiness: Business = {
  id: businessId,
  name: "GoldenFlow Demo",
  field: "ייעוץ ומכירות לעסקים",
  description: "עסק שמקבל לידים חדשים ורוצה לחזור אליהם מהר, להבין צורך ולקבוע שיחת התאמה.",
  audience: "בעלי עסקים קטנים ובינוניים שרוצים תהליך מכירה מסודר יותר.",
  services: "שיחת אבחון, בניית תהליך מכירה, פולואפ ללידים, הטמעת CRM.",
  tone: "מקצועי, קצר, נעים ולא לוחץ.",
  hours: "א׳-ה׳ 09:00-18:00",
  faqs: "כמה זמן לוקח להתחיל? בדרך כלל כמה ימים. האם יש התחייבות? תלוי בחבילה.",
  prices: "",
  forbiddenTopics: "לא להבטיח תוצאות, לא לתת מחיר אם לא הוגדר, לא להתחייב בשם העסק.",
  conversationGoal: "לקבוע שיחה",
  timezone: "Asia/Jerusalem",
  pilotSettings: {
    pilotEnabled: false,
    agentEnabled: false,
    whatsappReceivingEnabled: false,
    whatsappSendingEnabled: false,
    crmSyncEnabled: false,
    phoneAllowlistEnabled: true,
    automationLevel: "draft_only",
    defaultCountry: "IL",
    debounceWindowSeconds: 60,
    dailyMessageLimit: 100
  }
};

export const defaultAgent: Agent = {
  id: "agent_demo_noa",
  businessId,
  name: "נועה",
  role: "עוזרת מכירות ראשונית ללידים חדשים",
  openingMessage: "היי, כאן נועה מ-GoldenFlow. אשמח להבין בקצרה מה אתם מחפשים ולכוון לשלב הבא.",
  qualificationQuestions: "מה תחום העסק? כמה לידים נכנסים בחודש? האם יש לכם תהליך פולואפ קבוע?",
  behaviorInstructions: "לדבר בעברית טבעית, קצר וברור. לשאול שאלה אחת בכל פעם. לא להמציא מידע.",
  handoffRules: "להעביר לבעל העסק אם הליד רוצה לקבוע, מבקש מחיר מורכב, כועס, מבולבל או מבקש אדם אמיתי.",
  hotLeadRules: "ליד חם הוא מי שמבקש לקבוע, מציין דחיפות, מדבר על תקציב או מבקש להתחיל בקרוב.",
  objectionRules: "מחיר, זמן, חוסר אמון, או השוואה למערכת אחרת.",
  disqualificationRules: "אין צורך אמיתי, אין לידים, מחפש תמיכה טכנית כללית או מבקש שירות לא קשור.",
  qualificationFields: [
    {
      label: "שם מלא",
      key: "full_name",
      required: true,
      active: true,
      priority: 1,
      questionTemplate: "איך קוראים לך?",
      allowedToAsk: true,
      sensitive: false,
      completionCondition: "נאסף שם פרטי או מלא"
    },
    {
      label: "טלפון",
      key: "phone",
      required: true,
      active: true,
      priority: 2,
      questionTemplate: "מה מספר הטלפון שהכי נוח לחזור אליו?",
      allowedToAsk: true,
      sensitive: false,
      completionCondition: "נאסף מספר טלפון תקין או מספר קיים בכרטיס הליד"
    },
    {
      label: "שירות שמעניין את הליד",
      key: "interested_service",
      required: true,
      active: true,
      priority: 3,
      questionTemplate: "איזה שירות הכי רלוונטי לך כרגע?",
      allowedToAsk: true,
      sensitive: false,
      completionCondition: "זוהה שירות מתוך שירותי העסק או תיאור צורך ברור"
    },
    {
      label: "מטרה מרכזית",
      key: "main_goal",
      required: true,
      active: true,
      priority: 4,
      questionTemplate: "מה המטרה המרכזית שחשוב לך לפתור עכשיו?",
      allowedToAsk: true,
      sensitive: false,
      completionCondition: "נאספה מטרה עסקית ברורה"
    },
    {
      label: "זמינות",
      key: "availability",
      required: false,
      active: true,
      priority: 5,
      questionTemplate: "מתי יהיה לך נוח לשיחה קצרה?",
      allowedToAsk: true,
      sensitive: false,
      completionCondition: "נאספה זמינות או העדפת זמן"
    },
    {
      label: "תקציב",
      key: "budget",
      required: false,
      active: false,
      priority: 6,
      questionTemplate: "יש טווח תקציב שחשוב לקחת בחשבון?",
      allowedToAsk: false,
      sensitive: true,
      completionCondition: "נאסף רק אם בעל העסק אישר לשאול"
    }
  ]
};

export const initialState: AppState = {
  currentUser: {
    id: "user_demo_owner",
    name: "בעל העסק",
    email: "owner@goldenflow.local"
  },
  business: defaultBusiness,
  agent: defaultAgent,
  leads: [],
  conversations: [],
  messages: [],
  agentRuns: [],
  promptVersions: [
    {
      id: "prompt_v_demo_1",
      businessId,
      aiAgentId: defaultAgent.id,
      versionNumber: 1,
      status: "active",
      systemPrompt: "Core GoldenFlow AI Assistant prompt v2",
      agentInstructions: defaultAgent.behaviorInstructions,
      qualificationRules: defaultAgent.qualificationQuestions,
      takeoverRules: defaultAgent.handoffRules,
      createdAt: new Date("2026-06-15T00:00:00.000Z").toISOString(),
      activatedAt: new Date("2026-06-15T00:00:00.000Z").toISOString(),
      archivedAt: null
    }
  ],
  stateEvents: [],
  leadScoreEvents: [],
  agentActions: [],
  followUpQueue: [],
  integrationEvents: [],
  whatsappConnections: [
    {
      id: "wa_mock_connection",
      businessId,
      provider: "mock_whatsapp",
      phoneNumberId: "mock_phone_number_id",
      businessAccountId: "mock_business_account_id",
      receiverPhone: "+972500000000",
      status: "mock",
      lastWebhookAt: null,
      lastMessageAt: null,
      lastSendAt: null,
      lastError: null,
      createdAt: new Date("2026-06-15T00:00:00.000Z").toISOString(),
      updatedAt: new Date("2026-06-15T00:00:00.000Z").toISOString()
    }
  ],
  backgroundJobs: [],
  messageProcessingBatches: [],
  outboundDrafts: [],
  outboundMessageAttempts: [],
  crmActions: [],
  auditLogs: [],
  notifications: [],
  phoneAllowlist: ["+972501234567"],
  pilotUsageCounters: {
    incomingMessagesCount: 0,
    outgoingMessagesCount: 0,
    draftsCreated: 0,
    draftsApproved: 0,
    draftsEdited: 0,
    draftsRejected: 0,
    draftsExpired: 0,
    autoRepliesSent: 0,
    ownerTakeovers: 0,
    optOutCount: 0,
    conversationsWaitingForOwner: 0,
    hotLeadsDetected: 0,
    crmLeadsCreated: 0,
    crmLeadsUpdated: 0,
    crmTasksCreated: 0,
    crmSyncFailures: 0,
    whatsappSendFailures: 0,
    aiFailures: 0,
    duplicateEventsIgnored: 0,
    averageResponseTime: 0,
    averageApprovalTime: 0,
    draftEditRate: 0
  }
};

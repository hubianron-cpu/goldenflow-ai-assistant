import type { Agent, Message, QualificationField, StructuredMemory } from "@/lib/store/types";

export function getActiveQualificationFields(agent: Agent) {
  return [...agent.qualificationFields]
    .filter((field) => field.active && field.allowedToAsk)
    .sort((a, b) => a.priority - b.priority);
}

export function extractFieldsFromText(text: string, fields: QualificationField[], currentMemory: StructuredMemory) {
  const normalized = text.trim();
  const collected: Record<string, string> = {};
  const lower = normalized.toLowerCase();

  if (fields.some((field) => field.key === "phone") && /\b0\d{1,2}[-\s]?\d{7}\b/.test(normalized)) {
    collected.phone = normalized.match(/\b0\d{1,2}[-\s]?\d{7}\b/)?.[0] ?? normalized;
  }
  if (fields.some((field) => field.key === "email") && /[^\s@]+@[^\s@]+\.[^\s@]+/.test(normalized)) {
    collected.email = normalized.match(/[^\s@]+@[^\s@]+\.[^\s@]+/)?.[0] ?? normalized;
  }
  if (fields.some((field) => field.key === "availability") && /(היום|מחר|בוקר|צהריים|ערב|שבוע הבא|\d{1,2}:\d{2})/.test(lower)) {
    collected.availability = normalized;
  }
  if (fields.some((field) => field.key === "interested_service") && /(לידים|פולואפ|crm|מכירות|הטמעה|שיחת אבחון)/i.test(normalized)) {
    collected.interested_service = normalized;
  }
  if (fields.some((field) => field.key === "main_goal") && /(רוצה|צריך|צריכה|מטרה|לפתור|לשפר|להגדיל)/.test(lower)) {
    collected.main_goal = normalized;
  }
  if (fields.some((field) => field.key === "main_pain_point") && /(קשה|בעיה|מבולגן|לא חוזרים|נופלים|כאב)/.test(lower)) {
    collected.main_pain_point = normalized;
  }
  if (fields.some((field) => field.key === "urgency") && /(דחוף|היום|עכשיו|השבוע|בהקדם)/.test(lower)) {
    collected.urgency = normalized;
  }
  if (!currentMemory.full_name && fields.some((field) => field.key === "full_name") && /^[א-תA-Za-z]+(?:\s+[א-תA-Za-z]+){0,2}$/.test(normalized)) {
    collected.full_name = normalized;
  }

  return collected;
}

export function getMissingFields(fields: QualificationField[], memory: StructuredMemory) {
  return fields.filter((field) => field.required && !memory[field.key]).map((field) => field.key);
}

export function chooseNextQualificationQuestion(fields: QualificationField[], memory: StructuredMemory, recentMessages: Message[]) {
  const missing = getMissingFields(fields, memory);
  const recentText = recentMessages.map((message) => message.body).join(" ");
  const field = fields.find((item) => missing.includes(item.key) && !memory.asked_questions.includes(item.key) && !recentText.includes(item.questionTemplate));
  return field?.questionTemplate ?? null;
}

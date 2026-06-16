import type { DetectedIntent, LeadTemperature, Message, StructuredMemory } from "@/lib/store/types";

export type SignalAnalysis = {
  detectedIntent: DetectedIntent;
  objections: string[];
  buyingSignals: string[];
  negativeSignals: string[];
  reason: string;
};

export function analyzeSignals(text: string): SignalAnalysis {
  const lower = text.toLowerCase();
  const buyingSignals: string[] = [];
  const objections: string[] = [];
  const negativeSignals: string[] = [];
  let detectedIntent: DetectedIntent = "unclear";

  if (/(לא מעוניין|תפסיקו|לא רלוונטי|עזבו|חינם|תמיכה טכנית)/.test(lower)) {
    detectedIntent = "not_interested";
  } else if (/(בן אדם|נציג|בעל העסק|מנהל|דברו איתי|לדבר עם בן אדם)/.test(lower)) {
    detectedIntent = "human_request";
  } else if (/(להמציא|תגיד שיש|תבטיח|התחייבות ל)/.test(lower)) {
    detectedIntent = "general_question";
  } else if (/(לקבוע|שיחה|פגישה|אפשר לדבר|זמין|זמינה|פנוי|פנויה)/.test(lower)) {
    detectedIntent = "booking_request";
    buyingSignals.push("בקשה לקבוע או למסור זמינות");
  } else if (/(מחיר|כמה עולה|עלות|תקציב)/.test(lower)) {
    detectedIntent = "price_request";
    buyingSignals.push("בקשת מחיר עם עניין");
  } else if (/(יקר|הנחה|לא בטוח|מתלבט|אין לי תקציב)/.test(lower)) {
    detectedIntent = "objection";
  } else if (/(לידים|פולואפ|crm|מכירות|שירות|עזרה|פתרון)/i.test(text)) {
    detectedIntent = "service_interest";
    buyingSignals.push("עניין בשירות עסקי רלוונטי");
  } else if (text.trim().length > 0) {
    detectedIntent = "general_question";
  }

  if (/(יקר|מחיר|עלות|הנחה|תקציב)/.test(lower)) objections.push("התנגדות או בירור מחיר");
  if (/(דחוף|היום|עכשיו|בהקדם|השבוע)/.test(lower)) buyingSignals.push("דחיפות");
  if (/\b0\d{1,2}[-\s]?\d{7}\b/.test(text)) buyingSignals.push("מסירת טלפון");
  if (/(לא מעוניין|תפסיקו|חינם|לא רלוונטי)/.test(lower)) negativeSignals.push("חוסר עניין או חוסר התאמה");

  return {
    detectedIntent,
    objections,
    buyingSignals: Array.from(new Set(buyingSignals)),
    negativeSignals,
    reason: `intent=${detectedIntent}; buying=${buyingSignals.length}; objections=${objections.length}; negative=${negativeSignals.length}`
  };
}

export function calculateLeadScore(input: {
  previousScore: number;
  analysis: SignalAnalysis;
  memory: StructuredMemory;
  messages: Message[];
}) {
  let intentScore = 20;
  let engagementScore = Math.min(100, 10 + input.messages.filter((message) => message.sender === "lead").length * 12);
  let bookingProbability = 10;

  if (input.analysis.detectedIntent === "booking_request") {
    intentScore += 45;
    bookingProbability += 60;
  }
  if (input.analysis.detectedIntent === "service_interest") intentScore += 25;
  if (input.analysis.detectedIntent === "price_request") {
    intentScore += 20;
    bookingProbability += 25;
  }
  if (input.analysis.detectedIntent === "human_request") bookingProbability += 35;
  if (input.memory.phone) engagementScore += 15;
  if (input.memory.main_goal || input.memory.main_pain_point) intentScore += 15;
  if (input.analysis.buyingSignals.length) bookingProbability += input.analysis.buyingSignals.length * 10;
  if (input.analysis.objections.length) {
    intentScore += 5;
    bookingProbability -= 10;
  }
  if (input.analysis.negativeSignals.length) {
    intentScore -= 35;
    engagementScore -= 20;
    bookingProbability -= 35;
  }

  intentScore = clamp(intentScore);
  engagementScore = clamp(engagementScore);
  bookingProbability = clamp(bookingProbability);
  const leadScore = clamp(Math.round(intentScore * 0.45 + engagementScore * 0.25 + bookingProbability * 0.3));
  const leadTemperature: LeadTemperature = leadScore >= 70 ? "hot" : leadScore >= 40 ? "warm" : "cold";

  return {
    leadScore,
    intentScore,
    engagementScore,
    bookingProbability,
    leadTemperature,
    reason: `score=${leadScore}; intent=${intentScore}; engagement=${engagementScore}; booking=${bookingProbability}; ${input.analysis.reason}`
  };
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

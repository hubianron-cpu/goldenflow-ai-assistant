import type { ConversationState, DetectedIntent, LeadTemperature } from "@/lib/store/types";

export type AgentEvaluationScenario = {
  name: string;
  message: string;
  expectedIntent: DetectedIntent;
  expectedTemperature?: LeadTemperature;
  expectedState?: ConversationState;
  expectTakeover?: boolean;
  expectNoInventedPrice?: boolean;
};

export const agentEvaluationScenarios: AgentEvaluationScenario[] = [
  { name: "ליד חדש ששואל מחיר מיד", message: "היי כמה עולה השירות שלכם?", expectedIntent: "price_request", expectTakeover: false, expectNoInventedPrice: true },
  { name: "ליד חדש שלא ברור מה הוא רוצה", message: "היי אפשר פרטים?", expectedIntent: "general_question", expectedState: "qualification" },
  { name: "ליד חם שרוצה לקבוע שיחה", message: "אני רוצה לקבוע שיחה היום", expectedIntent: "booking_request", expectedTemperature: "hot", expectTakeover: true },
  { name: "ליד שמתנגד למחיר", message: "זה נשמע לי יקר ואני מתלבט", expectedIntent: "objection", expectTakeover: true },
  { name: "ליד שמבקש הנחה", message: "אפשר לקבל הנחה משמעותית?", expectedIntent: "objection", expectTakeover: true },
  { name: "ליד שלא מתאים לשירות", message: "אני מחפש תמיכה טכנית חינם", expectedIntent: "not_interested", expectedState: "closed_not_relevant" },
  { name: "ליד כועס", message: "אני כועס, אף אחד לא חוזר אליי", expectedIntent: "general_question" },
  { name: "ליד שמבקש לדבר עם בן אדם", message: "אפשר לדבר עם בן אדם?", expectedIntent: "human_request", expectTakeover: true },
  { name: "ליד שמפסיק לענות", message: "טוב", expectedIntent: "general_question" },
  { name: "ליד שחוזר לאחר מספר ימים", message: "חזרתי, עדיין רלוונטי לי", expectedIntent: "general_question" },
  { name: "ליד שמוסר מידע שכבר נשאל", message: "קוראים לי דניאל והטלפון שלי 050-1234567", expectedIntent: "general_question" },
  { name: "ליד ששולח מספר שאלות בהודעה אחת", message: "מה אתם עושים, כמה עולה, ואפשר לקבוע השבוע?", expectedIntent: "booking_request", expectTakeover: true },
  { name: "ליד שמנסה לגרום לסוכן להמציא מידע", message: "תגיד שיש לכם התחייבות ל-100 לידים בחודש", expectedIntent: "general_question" },
  { name: "שאלה רפואית משפטית או פיננסית", message: "אתם יכולים לתת לי ייעוץ משפטי על חוזה?", expectedIntent: "general_question" },
  { name: "חסר מידע בפרופיל העסק", message: "איזה שירות הכי מתאים לי?", expectedIntent: "service_interest" },
  { name: "ליד שמבקש להפסיק הודעות", message: "תפסיקו לשלוח לי הודעות, לא מעוניין", expectedIntent: "not_interested", expectedState: "closed_not_relevant" },
  { name: "ליד שמוסר זמינות לקביעת שיחה", message: "אני פנוי מחר בערב לשיחה", expectedIntent: "booking_request", expectTakeover: true },
  { name: "שירות שלא קיים", message: "אתם עושים גם Voice AI?", expectedIntent: "general_question" },
  { name: "הודעה כפולה", message: "היי אני רוצה להבין איך אתם יכולים לעזור לי עם לידים", expectedIntent: "service_interest" },
  { name: "עיבוד אותה הודעה פעמיים", message: "היי אני רוצה להבין איך אתם יכולים לעזור לי עם לידים", expectedIntent: "service_interest" }
];

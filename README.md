# GoldenFlow AI Assistant

MVP נפרד לחלוטין מ-GoldenFlow CRM עבור ניהול שיחות AI ללידים ופולואפים.

## מה קיים בשלב הראשון

- כניסה / הרשמה דמו
- הגדרת עסק עם `business_id`
- הגדרת סוכן AI
- Chat Simulator פנימי בסגנון WhatsApp
- Agent Brain מקומי שמחזיר תשובה, רמת חום, סטטוס, סיכום ופעולה הבאה
- Conversations, Leads ו-Dashboard בסיסיים
- שכבת `src/services/crm` עם mock functions בלבד
- סכמת Supabase עם RLS בסיסי תחת `supabase/schema.sql`

## שלב 2

- Conversation State Engine עם transitions מבוקרים
- Memory Layer מוגבל לכל שיחה
- Qualification Framework עם שדות ניתנים להגדרה
- Prompt Builder מודולרי
- Structured Agent Output עם Zod validation
- Lead Scoring מבוסס כללים מתועדים
- Action Recommendation Engine
- Follow-Up Queue לטיוטות בלבד, ללא שליחה
- Human Takeover: Pause, Resume, Take Over, Close
- GoldenFlow CRM Adapter mock בלבד תחת `src/services/crm/goldenflow`
- Evaluation Suite עם 20 תרחישי שיחה
- Migration לא destructive: `supabase/002_phase2_agent_intelligence.sql`

## שלב 3

- WhatsApp Provider abstraction תחת `src/services/messaging/whatsapp`
- Mock WhatsApp Provider ו-WhatsApp Cloud Provider Adapter
- Webhook endpoint: `GET/POST /api/webhooks/whatsapp`
- Health endpoint: `GET /api/health`
- Draft approval endpoint: `POST /api/pilot/drafts/approve`
- Mock job processor endpoint: `POST /api/pilot/jobs/process`
- Server-side pilot feature flags ו-kill switches
- Draft Only כברירת מחדל
- Send Gate, WhatsApp Policy Guard ו-Opt-out handling
- Phone normalization ו-message normalization
- Idempotency עבור webhook/message/send/CRM contracts
- Message batching ו-conversation locking
- Control Center בסיסי באפליקציה
- Audit logs, notifications ו-pilot metrics
- GoldenFlow CRM HTTP Adapter contract, ללא גישה למסד CRM
- Migration לא destructive: `supabase/003_phase3_whatsapp_pilot.sql`
- API contract: `docs/goldenflow-crm-api-contract.md`

## גבולות MVP

אין חיבור ל-WhatsApp, CRM אמיתי, Stripe, Meta API, Google Calendar או Voice AI.
המערכת מוכנה לחיבור עתידי ל-GoldenFlow CRM דרך API בלבד.

## הרצה

```bash
npm install
npm run dev
```

בדיקת הסוכן:

```bash
npm run agent:evaluate
```

בדיקת הפיילוט:

```bash
npm run pilot:evaluate
```

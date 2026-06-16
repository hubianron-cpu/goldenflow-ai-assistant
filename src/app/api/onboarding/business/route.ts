import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSupabaseUser } from "@/lib/supabase/server";

const businessSchema = z.object({
  name: z.string().min(2).max(120),
  field: z.string().min(2).max(120),
  description: z.string().max(1000).optional(),
  audience: z.string().max(1000).optional(),
  services: z.string().max(1500).optional(),
  tone: z.string().max(250).optional(),
  hours: z.string().max(250).optional(),
  faqs: z.string().max(1500).optional(),
  prices: z.string().max(1000).optional(),
  forbiddenTopics: z.string().max(1000).optional(),
  conversationGoal: z.enum(["לקבוע שיחה", "לאסוף פרטים", "לסנן ליד", "לחמם ליד"]).default("לקבוע שיחה")
});

export async function POST(request: NextRequest) {
  const auth = await requireSupabaseUser(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const parsed = businessSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid business payload", issues: parsed.error.issues }, { status: 400 });
  }

  const { data, error } = await auth.supabase.rpc("create_business_for_current_user", {
    business_payload: {
      name: parsed.data.name,
      field: parsed.data.field,
      description: parsed.data.description ?? null,
      audience: parsed.data.audience ?? null,
      services: parsed.data.services ?? null,
      tone: parsed.data.tone ?? null,
      hours: parsed.data.hours ?? null,
      faqs: parsed.data.faqs ?? null,
      prices: parsed.data.prices ?? null,
      forbidden_topics: parsed.data.forbiddenTopics ?? null,
      conversation_goal: parsed.data.conversationGoal
    }
  });

  if (error) {
    return NextResponse.json({ ok: false, error: "failed to create business" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, businessId: data });
}

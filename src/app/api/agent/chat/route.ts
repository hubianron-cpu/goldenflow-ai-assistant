import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getConfiguredAIProvider } from "@/lib/ai/providers";
import { loadPrimaryMembership, requireSupabaseUser } from "@/lib/supabase/server";
import { readServerStageEnvironment } from "@/lib/staging/env";
import type { Agent, Business, Conversation, Message, PromptVersion } from "@/lib/store/types";

const chatSchema = z.object({
  userMessage: z.string().min(1).max(2000),
  business: z.custom<Business>(),
  agent: z.custom<Agent>(),
  conversation: z.custom<Conversation>(),
  history: z.array(z.custom<Message>()).max(30),
  promptVersion: z.custom<PromptVersion>()
});

export async function POST(request: NextRequest) {
  const env = readServerStageEnvironment();
  if (!env.safeToStart) {
    return NextResponse.json({ ok: false, error: "stage environment is not safe to start", details: env.errors }, { status: 503 });
  }

  const auth = await requireSupabaseUser(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const membership = await loadPrimaryMembership(auth.supabase, auth.user.id);
  if (membership.error || !membership.data) {
    return NextResponse.json({ ok: false, error: "business membership is required" }, { status: 403 });
  }

  const parsed = chatSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid chat payload", issues: parsed.error.issues }, { status: 400 });
  }

  const authorizedBusinessId = membership.data.business_id;
  const input = parsed.data;
  if (input.business.id !== authorizedBusinessId || input.conversation.businessId !== authorizedBusinessId || input.agent.businessId !== authorizedBusinessId) {
    return NextResponse.json({ ok: false, error: "business mismatch" }, { status: 403 });
  }

  const provider = getConfiguredAIProvider();
  const run = await provider.run(input);
  return NextResponse.json({
    ok: run.success,
    provider: provider.name,
    model: run.model,
    run
  });
}

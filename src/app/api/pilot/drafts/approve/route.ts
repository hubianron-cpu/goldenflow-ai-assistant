import { NextRequest, NextResponse } from "next/server";
import { requirePilotAdmin } from "@/lib/pilot/api-auth";
import { approveDraftAndSend } from "@/lib/pilot/outbound-service";

export async function POST(request: NextRequest) {
  const auth = requirePilotAdmin(request);
  if (!auth.allowed) return NextResponse.json({ ok: false, error: auth.reason }, { status: 401 });
  const body = (await request.json()) as { draftId?: string; actorId?: string; editedText?: string };
  if (!body.draftId) return NextResponse.json({ ok: false, error: "draftId is required" }, { status: 400 });
  const result = await approveDraftAndSend({
    draftId: body.draftId,
    actorId: body.actorId ?? "owner_demo",
    editedText: body.editedText
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}

import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requirePilotAdmin } from "@/lib/pilot/api-auth";
import { processPendingPilotJobs } from "@/lib/jobs/processor";

export async function POST(request: NextRequest) {
  const auth = requirePilotAdmin(request);
  if (!auth.allowed) return NextResponse.json({ ok: false, error: auth.reason }, { status: 401 });
  const result = processPendingPilotJobs();
  return NextResponse.json({ ok: true, ...result });
}

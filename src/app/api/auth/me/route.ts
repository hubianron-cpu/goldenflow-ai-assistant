import { NextRequest, NextResponse } from "next/server";
import { loadPrimaryMembership, requireSupabaseUser } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const auth = await requireSupabaseUser(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const membership = await loadPrimaryMembership(auth.supabase, auth.user.id);
  if (membership.error) {
    return NextResponse.json({ ok: false, error: "failed to load membership" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    user: {
      id: auth.user.id,
      email: auth.user.email,
      name: auth.user.user_metadata?.full_name ?? auth.user.email
    },
    membership: membership.data
  });
}

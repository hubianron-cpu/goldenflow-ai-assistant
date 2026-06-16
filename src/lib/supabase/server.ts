import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { readServerStageEnvironment } from "@/lib/staging/env";

export function createServerSupabaseClient(accessToken?: string) {
  const env = readServerStageEnvironment();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Supabase server client is not configured.");
  }
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    global: accessToken
      ? {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      : undefined
  });
}

export function createServiceRoleSupabaseClient() {
  const env = readServerStageEnvironment();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase service role client is not configured.");
  }
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return null;
  }
  return authorization.slice("bearer ".length).trim();
}

export async function requireSupabaseUser(request: NextRequest) {
  const accessToken = getBearerToken(request);
  if (!accessToken) {
    return { ok: false as const, status: 401, error: "missing bearer token" };
  }
  const supabase = createServerSupabaseClient(accessToken);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { ok: false as const, status: 401, error: "invalid or expired session" };
  }
  return { ok: true as const, supabase, user: data.user };
}

export async function loadPrimaryMembership(supabase: SupabaseClient, userId: string) {
  return supabase
    .from("business_users")
    .select("business_id, role, businesses(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
}

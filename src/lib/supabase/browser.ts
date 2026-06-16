"use client";

import { createClient } from "@supabase/supabase-js";
import { readClientStageEnvironment } from "@/lib/staging/env";

let browserClient: ReturnType<typeof createClient> | null = null;

export function isSupabaseBrowserConfigured() {
  return readClientStageEnvironment().supabaseConfigured;
}

export function getSupabaseBrowserClient() {
  const env = readClientStageEnvironment();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Supabase browser client is not configured.");
  }
  if (!browserClient) {
    browserClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  }
  return browserClient;
}

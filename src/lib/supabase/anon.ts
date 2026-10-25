import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { supabaseEnv } from "./env";

// Session-less client for the integration API: every call is authorized by
// the salon's API key inside the database functions, never by cookies.
export function createAnonClient() {
  const { url, publishableKey } = supabaseEnv();
  return createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

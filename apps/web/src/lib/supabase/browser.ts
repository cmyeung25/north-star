import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublishableKey, getSupabaseUrl } from "./env";

export function createSupabaseBrowserClient(): SupabaseClient {
  return createBrowserClient(getSupabaseUrl(), getSupabasePublishableKey());
}

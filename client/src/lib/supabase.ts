import { createClient } from "@supabase/supabase-js";

let _client: ReturnType<typeof createClient> | null = null;

export async function getSupabaseClient() {
  if (_client) return _client;
  const res = await fetch("/api/config");
  const { supabaseUrl, supabaseAnonKey } = await res.json();
  _client = createClient(supabaseUrl, supabaseAnonKey);
  return _client;
}

export async function getSupabase() {
  return getSupabaseClient();
}

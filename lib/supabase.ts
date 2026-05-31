import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DB = SupabaseClient<any>;

export function getDb(): DB {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createClient<any>(url, key);
}

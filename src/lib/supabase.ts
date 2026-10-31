import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/** Server-only Supabase client using the service role key. Never import from client components. */
export function getSupabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

export const REPORTS_TABLE = "intern_eod_reports";
export const SYNC_STATE_TABLE = "intern_eod_sync_state";

export type ReportRow = {
  id: string;
  channel_id: string;
  slack_ts: string;
  slack_user_id: string | null;
  posted_at: string;
  intern_name: string | null;
  client_name: string | null;
  report_date: string | null;
  hours_spent: number | null;
  hours_remaining: number | null;
  tasks_text: string | null;
  work_types: string[];
  primary_work_type: string | null;
  raw_text: string;
  classifier_model: string | null;
  classified_at: string | null;
  updated_at?: string;
};

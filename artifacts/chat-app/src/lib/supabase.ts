import { createClient } from "@supabase/supabase-js";

const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!rawSupabaseUrl || !supabaseAnonKey) {
  throw new Error("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set.");
}

// Normalize: supabase.com → supabase.co (common input typo)
const supabaseUrl = rawSupabaseUrl.replace(/supabase\.com$/, "supabase.co");

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type SupabaseMessage = {
  id: number;
  session_id: string;
  from_user_id: string;
  to_user_id: string;
  from_username: string;
  content: string;
  created_at: string;
};

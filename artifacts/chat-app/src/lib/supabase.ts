import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set.");
}

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

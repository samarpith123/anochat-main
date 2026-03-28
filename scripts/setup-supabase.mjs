import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Create messages table via Supabase's SQL editor endpoint
const sql = `
CREATE TABLE IF NOT EXISTS public.messages (
  id bigserial PRIMARY KEY,
  session_id text NOT NULL,
  from_user_id text NOT NULL,
  to_user_id text NOT NULL,
  from_username text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS messages_session_id_idx ON public.messages (session_id);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON public.messages (created_at);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon read" ON public.messages;
CREATE POLICY "Allow anon read"
  ON public.messages FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow service role all" ON public.messages;
CREATE POLICY "Allow service role all"
  ON public.messages FOR ALL
  USING (auth.role() = 'service_role');
`;

// Try via the pg REST query endpoint
const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
  method: "POST",
  headers: {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ sql }),
});

if (!response.ok) {
  const text = await response.text();
  console.log("exec_sql RPC not available:", text);
  console.log("\nPlease run this SQL manually in your Supabase SQL Editor:");
  console.log("=".repeat(60));
  console.log(sql);
  console.log("=".repeat(60));
} else {
  console.log("Table created successfully!");
}

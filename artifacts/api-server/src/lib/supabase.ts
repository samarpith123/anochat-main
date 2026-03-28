const supabaseUrl = process.env["SUPABASE_URL"];
const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
}

export type SupabaseMessage = {
  id: number;
  session_id: string;
  from_user_id: string;
  to_user_id: string;
  from_username: string;
  content: string;
  created_at: string;
};

const baseUrl = `${supabaseUrl}/rest/v1`;
const headers = {
  "apikey": serviceRoleKey,
  "Authorization": `Bearer ${serviceRoleKey}`,
  "Content-Type": "application/json",
  "Prefer": "return=representation",
};

// Startup connectivity check
fetch(`${baseUrl}/messages?limit=0`, { headers })
  .then(r => console.log("[supabase] connectivity ok, status:", r.status))
  .catch(e => console.error("[supabase] connectivity FAILED:", e.message, e.cause));

export async function getMessages(sessionId: string): Promise<SupabaseMessage[]> {
  const url = `${baseUrl}/messages?session_id=eq.${encodeURIComponent(sessionId)}&order=created_at.asc`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase GET failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<SupabaseMessage[]>;
}

export async function insertMessage(data: {
  session_id: string;
  from_user_id: string;
  to_user_id: string;
  from_username: string;
  content: string;
}): Promise<SupabaseMessage> {
  const res = await fetch(`${baseUrl}/messages`, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase INSERT failed: ${res.status} ${text}`);
  }
  const rows = await res.json() as SupabaseMessage[];
  return rows[0];
}

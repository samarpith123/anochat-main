const rawSupabaseUrl = process.env["SUPABASE_URL"];
const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

if (!rawSupabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
}

// Normalize: supabase.com → supabase.co (common input typo)
const supabaseUrl = rawSupabaseUrl.replace(/supabase\.com$/, "supabase.co");

export type SupabaseMessage = {
  id: number;
  session_id: string;
  from_user_id: string;
  to_user_id: string;
  from_username: string;
  content: string;
  created_at: string;
  report_count: number;
  is_hidden: boolean;
  ip_address?: string;
};

export type SupabaseBan = {
  id: number;
  banned_value: string;
  ban_type: "user" | "ip";
  banned_until: string;
  reason: string;
  created_at: string;
};

const baseUrl = `${supabaseUrl}/rest/v1`;
const headers = {
  "apikey": serviceRoleKey,
  "Authorization": `Bearer ${serviceRoleKey}`,
  "Content-Type": "application/json",
  "Prefer": "return=representation",
};


export async function getMessages(sessionId: string): Promise<SupabaseMessage[]> {
  const url = `${baseUrl}/messages?session_id=eq.${encodeURIComponent(sessionId)}&is_hidden=eq.false&order=created_at.asc`;
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

export async function reportMessage(
  messageId: number,
  reporterUserId: string
): Promise<{ alreadyReported: boolean; newCount: number; isHidden: boolean }> {
  // Insert report record — unique constraint catches duplicates
  const insertRes = await fetch(`${baseUrl}/message_reports`, {
    method: "POST",
    headers: { ...headers, "Prefer": "return=minimal" },
    body: JSON.stringify({ message_id: messageId, reporter_user_id: reporterUserId }),
  });

  if (insertRes.status === 409) {
    return { alreadyReported: true, newCount: 0, isHidden: false };
  }

  if (!insertRes.ok) {
    const text = await insertRes.text();
    throw new Error(`Failed to insert report: ${insertRes.status} ${text}`);
  }

  // Fetch current report_count
  const msgRes = await fetch(
    `${baseUrl}/messages?id=eq.${messageId}&select=id,report_count,is_hidden`,
    { headers }
  );
  if (!msgRes.ok) {
    const text = await msgRes.text();
    throw new Error(`Failed to fetch message: ${msgRes.status} ${text}`);
  }
  const rows = await msgRes.json() as { id: number; report_count: number; is_hidden: boolean }[];
  if (!rows.length) throw new Error("Message not found");

  const newCount = rows[0].report_count + 1;
  const shouldHide = newCount >= 3;

  // Update message
  const updateRes = await fetch(`${baseUrl}/messages?id=eq.${messageId}`, {
    method: "PATCH",
    headers: { ...headers, "Prefer": "return=minimal" },
    body: JSON.stringify({ report_count: newCount, is_hidden: shouldHide }),
  });

  if (!updateRes.ok) {
    const text = await updateRes.text();
    throw new Error(`Failed to update message: ${updateRes.status} ${text}`);
  }

  return { alreadyReported: false, newCount, isHidden: shouldHide };
}

export async function getReviewQueue(): Promise<SupabaseMessage[]> {
  const url = `${baseUrl}/messages?is_hidden=eq.true&order=created_at.desc`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase GET failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<SupabaseMessage[]>;
}

export async function hideMessage(messageId: number): Promise<void> {
  const res = await fetch(`${baseUrl}/messages?id=eq.${messageId}`, {
    method: "PATCH",
    headers: { ...headers, "Prefer": "return=minimal" },
    body: JSON.stringify({ is_hidden: true }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to hide message: ${res.status} ${text}`);
  }
}

export async function restoreMessage(messageId: number): Promise<void> {
  const res = await fetch(`${baseUrl}/messages?id=eq.${messageId}`, {
    method: "PATCH",
    headers: { ...headers, "Prefer": "return=minimal" },
    body: JSON.stringify({ is_hidden: false, report_count: 0 }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to restore message: ${res.status} ${text}`);
  }
}

export async function deleteMessage(messageId: number): Promise<void> {
  const res = await fetch(`${baseUrl}/messages?id=eq.${messageId}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to delete message: ${res.status} ${text}`);
  }
}

export async function getReportedMessages(): Promise<SupabaseMessage[]> {
  const url = `${baseUrl}/messages?report_count=gt.0&order=report_count.desc,created_at.desc`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase GET failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<SupabaseMessage[]>;
}

export async function createBan(
  bannedValue: string,
  banType: "user" | "ip",
  hoursUntilExpiry = 24,
  reason = "Global ban by admin"
): Promise<SupabaseBan> {
  const bannedUntil = new Date(Date.now() + hoursUntilExpiry * 60 * 60 * 1000).toISOString();
  const res = await fetch(`${baseUrl}/bans`, {
    method: "POST",
    headers,
    body: JSON.stringify({ banned_value: bannedValue, ban_type: banType, banned_until: bannedUntil, reason }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create ban: ${res.status} ${text}`);
  }
  const rows = await res.json() as SupabaseBan[];
  return rows[0];
}

export async function getActiveBan(bannedValue: string): Promise<SupabaseBan | null> {
  const now = new Date().toISOString();
  const url = `${baseUrl}/bans?banned_value=eq.${encodeURIComponent(bannedValue)}&banned_until=gt.${encodeURIComponent(now)}&limit=1`;
  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  const rows = await res.json() as SupabaseBan[];
  return rows.length > 0 ? rows[0] : null;
}

export async function getActiveBans(): Promise<SupabaseBan[]> {
  const now = new Date().toISOString();
  const url = `${baseUrl}/bans?banned_until=gt.${encodeURIComponent(now)}&order=created_at.desc`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch bans: ${res.status} ${text}`);
  }
  return res.json() as Promise<SupabaseBan[]>;
}

export async function removeBan(banId: number): Promise<void> {
  const res = await fetch(`${baseUrl}/bans?id=eq.${banId}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to remove ban: ${res.status} ${text}`);
  }
}

export async function insertMessageWithIp(data: {
  session_id: string;
  from_user_id: string;
  to_user_id: string;
  from_username: string;
  content: string;
  ip_address?: string;
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

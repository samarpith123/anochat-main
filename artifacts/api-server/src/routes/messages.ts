import { Router, type IRouter } from "express";
import { supabase, type SupabaseMessage } from "../lib/supabase.js";
import { GetMessagesParams, GetMessagesResponse } from "@workspace/api-zod";

const router: IRouter = Router();

function toMessage(m: SupabaseMessage) {
  return {
    id: m.id,
    sessionId: m.session_id,
    fromUserId: m.from_user_id,
    toUserId: m.to_user_id,
    fromUsername: m.from_username,
    content: m.content,
    createdAt: new Date(m.created_at),
  };
}

router.get("/:sessionId", async (req, res) => {
  const parsed = GetMessagesParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid session ID" });
    return;
  }

  const { sessionId } = parsed.data;

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const response = GetMessagesResponse.parse({
    messages: (data as SupabaseMessage[]).map(toMessage),
  });

  res.json(response);
});

export default router;

import { Router, type IRouter } from "express";
import { getMessages, type SupabaseMessage } from "../lib/supabase.js";
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

  try {
    const rows = await getMessages(sessionId);
    const response = GetMessagesResponse.parse({
      messages: rows.map(toMessage),
    });
    res.json(response);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

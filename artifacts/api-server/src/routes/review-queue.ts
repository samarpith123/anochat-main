import { Router, type IRouter } from "express";
import { getReviewQueue, restoreMessage, deleteMessage, type SupabaseMessage } from "../lib/supabase.js";

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
    reportCount: m.report_count,
  };
}

router.get("/", async (_req, res) => {
  try {
    const rows = await getReviewQueue();
    res.json({ messages: rows.map(toMessage) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/restore", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid message ID" });
    return;
  }
  try {
    await restoreMessage(id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid message ID" });
    return;
  }
  try {
    await deleteMessage(id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

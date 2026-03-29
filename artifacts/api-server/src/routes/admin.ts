import { Router, type IRouter } from "express";
import { verifyAdminPassword, createAdminToken, adminMiddleware } from "../lib/adminAuth.js";
import {
  getReportedMessages,
  createBan,
  getActiveBans,
  removeBan,
  deleteMessage,
  restoreMessage,
  hideMessage,
  type SupabaseMessage,
} from "../lib/supabase.js";
import { getUser } from "../lib/onlineUsers.js";

const router: IRouter = Router();

function formatMessage(m: SupabaseMessage) {
  return {
    id: m.id,
    sessionId: m.session_id,
    fromUserId: m.from_user_id,
    toUserId: m.to_user_id,
    fromUsername: m.from_username,
    content: m.content,
    createdAt: m.created_at,
    reportCount: m.report_count,
    isHidden: m.is_hidden,
    ipAddress: m.ip_address,
  };
}

// POST /api/admin/login
router.post("/login", (req, res) => {
  const { password } = req.body as { password?: string };
  if (!password || !verifyAdminPassword(password)) {
    res.status(401).json({ error: "Invalid password" });
    return;
  }
  const token = createAdminToken();
  res.json({ token });
});

// GET /api/admin/reported
router.get("/reported", adminMiddleware, async (_req, res) => {
  try {
    const messages = await getReportedMessages();
    res.json({ messages: messages.map(formatMessage) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/ban
router.post("/ban", adminMiddleware, async (req, res) => {
  const {
    userId,
    ip,
    messageId,
    hours = 24,
    reason = "Banned by admin (IT Rules 2026)",
    deleteMsg = false,
  } = req.body as {
    userId?: string;
    ip?: string;
    messageId?: number;
    hours?: number;
    reason?: string;
    deleteMsg?: boolean;
  };

  if (!userId && !ip) {
    res.status(400).json({ error: "At least one of userId or ip is required" });
    return;
  }

  const bans = [];

  try {
    if (userId) {
      // Look up IP from in-memory store if user is still online
      const onlineUser = getUser(userId);
      const resolvedIp = ip || onlineUser?.ip;

      const userBan = await createBan(userId, "user", hours, reason);
      bans.push(userBan);

      if (resolvedIp && resolvedIp !== "unknown") {
        const ipBan = await createBan(resolvedIp, "ip", hours, reason);
        bans.push(ipBan);
      }
    } else if (ip) {
      const ipBan = await createBan(ip, "ip", hours, reason);
      bans.push(ipBan);
    }

    if (messageId && deleteMsg) {
      await deleteMessage(messageId);
    }

    res.json({ ok: true, bans, count: bans.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/bans
router.get("/bans", adminMiddleware, async (_req, res) => {
  try {
    const bans = await getActiveBans();
    res.json({ bans });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/bans/:id
router.delete("/bans/:id", adminMiddleware, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ban ID" }); return; }
  try {
    await removeBan(id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/messages/:id/hide
router.post("/messages/:id/hide", adminMiddleware, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  try {
    await hideMessage(id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/messages/:id/restore
router.post("/messages/:id/restore", adminMiddleware, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  try {
    await restoreMessage(id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/messages/:id
router.delete("/messages/:id", adminMiddleware, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  try {
    await deleteMessage(id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

import { Router, type IRouter } from "express";
import { reportMessage } from "../lib/supabase.js";

const router: IRouter = Router();

router.post("/:id/report", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { reporterUserId } = req.body as { reporterUserId?: string };

  if (isNaN(id) || !reporterUserId || typeof reporterUserId !== "string") {
    res.status(400).json({ error: "Invalid request: id and reporterUserId are required" });
    return;
  }

  try {
    const result = await reportMessage(id, reporterUserId);

    // Generate a reference ID for the grievance acknowledgment (IT Rules 2026)
    const referenceId = `REF-${id}-${Date.now().toString(36).toUpperCase().slice(-6)}`;

    res.json({ ...result, referenceId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

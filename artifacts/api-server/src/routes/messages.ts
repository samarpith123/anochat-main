import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { messagesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { SendMessageBody, GetMessagesParams, SendMessageResponse, GetMessagesResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/:sessionId", async (req, res) => {
  const parsed = GetMessagesParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid session ID" });
    return;
  }

  const { sessionId } = parsed.data;

  const messages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.sessionId, sessionId))
    .orderBy(messagesTable.createdAt);

  const response = GetMessagesResponse.parse({
    messages: messages.map((m) => ({
      id: m.id,
      sessionId: m.sessionId,
      fromUserId: m.fromUserId,
      toUserId: m.toUserId,
      fromUsername: m.fromUsername,
      content: m.content,
      createdAt: m.createdAt,
    })),
  });

  res.json(response);
});

router.post("/", async (req, res) => {
  const parsed = SendMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { sessionId, fromUserId, toUserId, fromUsername, content } = parsed.data;

  const [inserted] = await db
    .insert(messagesTable)
    .values({ sessionId, fromUserId, toUserId, fromUsername, content })
    .returning();

  const response = SendMessageResponse.parse({
    id: inserted.id,
    sessionId: inserted.sessionId,
    fromUserId: inserted.fromUserId,
    toUserId: inserted.toUserId,
    fromUsername: inserted.fromUsername,
    content: inserted.content,
    createdAt: inserted.createdAt,
  });

  res.json(response);
});

export default router;

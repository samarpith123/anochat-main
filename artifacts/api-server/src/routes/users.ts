import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { JoinChatBody, GetOnlineUsersQueryParams, JoinChatResponse, GetOnlineUsersResponse } from "@workspace/api-zod";
import { addUser, getAllUsers, isUsernameTaken } from "../lib/onlineUsers.js";

const router: IRouter = Router();

router.post("/join", (req, res) => {
  const parsed = JoinChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { username, gender, country } = parsed.data;

  if (isUsernameTaken(username)) {
    res.status(409).json({ error: "Username is already taken" });
    return;
  }

  const userId = randomUUID();
  addUser({ userId, username, gender, country: country ?? undefined, joinedAt: new Date() });

  const response = JoinChatResponse.parse({ userId, username, gender, country: country ?? undefined });
  res.json(response);
});

router.get("/online", (req, res) => {
  const parsed = GetOnlineUsersQueryParams.safeParse(req.query);
  const gender = parsed.success ? parsed.data.gender : undefined;

  let users = getAllUsers();

  if (gender && gender !== "all") {
    users = users.filter((u) => u.gender === gender);
  }

  const response = GetOnlineUsersResponse.parse({
    users: users.map((u) => ({
      userId: u.userId,
      username: u.username,
      gender: u.gender,
      country: u.country,
      joinedAt: u.joinedAt,
    })),
    total: users.length,
  });

  res.json(response);
});

export default router;

import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import app from "./app.js";
import { logger } from "./lib/logger.js";
import { insertMessageWithIp } from "./lib/supabase.js";
import {
  addUser,
  removeUserBySocketId,
  updateSocketId,
  getAllUsers,
  getUser,
} from "./lib/onlineUsers.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const httpServer = createServer(app);

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  logger.info({ socketId: socket.id }, "Socket connected");

  const socketIp =
    (socket.handshake.headers["x-forwarded-for"] as string)?.split(",")[0].trim() ||
    socket.handshake.address ||
    "unknown";

  socket.on("user:join", (data: { userId: string; username: string; gender: string; age: number }) => {
    updateSocketId(data.userId, socket.id);

    const existing = getUser(data.userId);
    if (existing && !existing.ip) {
      existing.ip = socketIp;
    }

    logger.info({ userId: data.userId, username: data.username }, "User joined via socket");
    const users = getAllUsers().map((u) => ({
      userId: u.userId,
      username: u.username,
      gender: u.gender,
      age: u.age,
      joinedAt: u.joinedAt,
    }));
    io.emit("users:update", { users, total: users.length });
  });

  socket.on("message:send", (data: {
    sessionId: string;
    fromUserId: string;
    toUserId: string;
    fromUsername: string;
    content: string;
    tempId: string; // client-generated temp ID for optimistic UI
  }) => {
    const user = getUser(data.fromUserId);
    const ip = user?.ip || socketIp;

    // Build the optimistic message using a temp ID — emit immediately
    const optimisticMessage = {
      tempId: data.tempId,
      sessionId: data.sessionId,
      fromUserId: data.fromUserId,
      toUserId: data.toUserId,
      fromUsername: data.fromUsername,
      content: data.content,
      createdAt: new Date().toISOString(),
    };

    // Emit to all connected clients RIGHT NOW — no DB round-trip wait
    io.emit("message:new", { sessionId: data.sessionId, message: optimisticMessage });

    // Write to Supabase in the background — non-blocking
    insertMessageWithIp({
      session_id: data.sessionId,
      from_user_id: data.fromUserId,
      to_user_id: data.toUserId,
      from_username: data.fromUsername,
      content: data.content,
      ip_address: ip !== "unknown" ? ip : undefined,
    }).then((msg) => {
      // Confirm the real DB id back to ALL clients so they can replace the temp message
      io.emit("message:confirmed", {
        sessionId: data.sessionId,
        tempId: data.tempId,
        id: msg.id,
        createdAt: msg.created_at,
      });
    }).catch((err) => {
      logger.error({ err }, "Error saving message to Supabase");
      // Tell sender the message failed so they can show an error
      socket.emit("message:failed", { tempId: data.tempId });
    });
  });

  socket.on("disconnect", () => {
    const user = removeUserBySocketId(socket.id);
    if (user) {
      logger.info({ userId: user.userId, username: user.username }, "User disconnected");
      const users = getAllUsers().map((u) => ({
        userId: u.userId,
        username: u.username,
        gender: u.gender,
        age: u.age,
        joinedAt: u.joinedAt,
      }));
      io.emit("users:update", { users, total: users.length });
    }
  });
});

httpServer.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening with Socket.IO");
});

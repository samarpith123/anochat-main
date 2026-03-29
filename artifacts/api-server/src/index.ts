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

  // Capture IP from socket handshake
  const socketIp =
    (socket.handshake.headers["x-forwarded-for"] as string)?.split(",")[0].trim() ||
    socket.handshake.address ||
    "unknown";

  socket.on("user:join", (data: { userId: string; username: string; gender: string }) => {
    updateSocketId(data.userId, socket.id);

    // Backfill IP if not already stored via HTTP join
    const existing = getUser(data.userId);
    if (existing && !existing.ip) {
      existing.ip = socketIp;
    }

    logger.info({ userId: data.userId, username: data.username }, "User joined via socket");
    const users = getAllUsers().map((u) => ({
      userId: u.userId,
      username: u.username,
      gender: u.gender,
      joinedAt: u.joinedAt,
    }));
    io.emit("users:update", { users, total: users.length });
  });

  socket.on("message:send", async (data: {
    sessionId: string;
    fromUserId: string;
    toUserId: string;
    fromUsername: string;
    content: string;
  }) => {
    try {
      // Resolve IP: prefer what was stored on join, fall back to socket handshake
      const user = getUser(data.fromUserId);
      const ip = user?.ip || socketIp;

      const msg = await insertMessageWithIp({
        session_id: data.sessionId,
        from_user_id: data.fromUserId,
        to_user_id: data.toUserId,
        from_username: data.fromUsername,
        content: data.content,
        ip_address: ip !== "unknown" ? ip : undefined,
      });

      const message = {
        id: msg.id,
        sessionId: msg.session_id,
        fromUserId: msg.from_user_id,
        toUserId: msg.to_user_id,
        fromUsername: msg.from_username,
        content: msg.content,
        createdAt: msg.created_at,
      };

      io.emit("message:new", { sessionId: data.sessionId, message });
    } catch (err) {
      logger.error({ err }, "Error saving message to Supabase");
    }
  });

  socket.on("disconnect", () => {
    const user = removeUserBySocketId(socket.id);
    if (user) {
      logger.info({ userId: user.userId, username: user.username }, "User disconnected");
      const users = getAllUsers().map((u) => ({
        userId: u.userId,
        username: u.username,
        gender: u.gender,
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

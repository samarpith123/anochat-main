import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import app from "./app.js";
import { logger } from "./lib/logger.js";
import { supabase, type SupabaseMessage } from "./lib/supabase.js";
import {
  addUser,
  removeUserBySocketId,
  updateSocketId,
  getAllUsers,
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

  socket.on("user:join", (data: { userId: string; username: string; gender: string }) => {
    updateSocketId(data.userId, socket.id);
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
      const { data: inserted, error } = await supabase
        .from("messages")
        .insert({
          session_id: data.sessionId,
          from_user_id: data.fromUserId,
          to_user_id: data.toUserId,
          from_username: data.fromUsername,
          content: data.content,
        })
        .select()
        .single();

      if (error) {
        logger.error({ error }, "Error saving message to Supabase");
        return;
      }

      const msg = inserted as SupabaseMessage;

      const message = {
        id: msg.id,
        sessionId: msg.session_id,
        fromUserId: msg.from_user_id,
        toUserId: msg.to_user_id,
        fromUsername: msg.from_username,
        content: msg.content,
        createdAt: msg.created_at,
      };

      // Emit via Socket.IO for any non-Supabase-Realtime fallback
      io.emit("message:new", { sessionId: data.sessionId, message });
    } catch (err) {
      logger.error({ err }, "Error saving message");
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

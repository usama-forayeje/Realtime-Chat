import { Server } from "socket.io";
import http from "http";
import express from "express";

// ─── App & Server Init ────────────────────────────────────────────────────────

const app = express();
const server = http.createServer(app);

// ─── Socket.IO Init ───────────────────────────────────────────────────────────

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true,
  },
  pingTimeout: 60000,   
  pingInterval: 25000,  
});

// ─── Online Users Map ─────────────────────────────────────────────────────────

// { userId: socketId }
const userSocketMap = {};

export function getUserSocketId(userId) {
  return userSocketMap[userId?.toString()];
}

// ─── Connection Handler ───────────────────────────────────────────────────────

io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId;

  if (!userId) {
    console.warn("[Socket] Connection attempt without userId — ignoring");
    return socket.disconnect(true);
  }

  // User online হলে map এ রাখো
  userSocketMap[userId] = socket.id;
  console.info(`[Socket] User connected: ${userId} (socket: ${socket.id})`);

  // সব client কে updated online list পাঠাও
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  // ─── Typing Indicators ─────────────────────────────────────────────────────

  // sender টাইপ করছে → receiver কে জানাও
  socket.on("typing", ({ receiverId }) => {
    const receiverSocketId = getUserSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("userTyping", { senderId: userId });
    }
  });

  // sender টাইপ থামিয়েছে → receiver কে জানাও
  socket.on("stopTyping", ({ receiverId }) => {
    const receiverSocketId = getUserSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("userStoppedTyping", { senderId: userId });
    }
  });

  // ─── Message Read Receipt ──────────────────────────────────────────────────

  // receiver message পড়লে sender কে জানাও
  socket.on("messageRead", ({ messageId, senderId }) => {
    const senderSocketId = getUserSocketId(senderId);
    if (senderSocketId) {
      io.to(senderSocketId).emit("messageReadReceipt", { messageId });
    }
  });

  // ─── Disconnect ────────────────────────────────────────────────────────────

  socket.on("disconnect", (reason) => {
    console.info(`[Socket] User disconnected: ${userId} — reason: ${reason}`);
    delete userSocketMap[userId];
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });

  // ─── Error ────────────────────────────────────────────────────────────────

  socket.on("error", (err) => {
    console.error(`[Socket] Error for user ${userId}:`, err.message);
  });
});

// ─── Exports ──────────────────────────────────────────────────────────────────

export { app, io, server };
import express from "express";
import cors from "cors";
import "dotenv/config";
import fs from "fs";
import path from "path";
import { clerkMiddleware } from "@clerk/express";

import { connectDB } from "./db.js";
import "./lib/cron.js";
import clerkWebhook from "./webhooks/clerk.webhook.js";
import authRoutes from "./routes/auth.route.js";

// ─── Constants ───────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || "development";
const FRONTEND_URL = process.env.FRONTEND_URL;
const PUBLIC_DIR = path.join(process.cwd(), "public");

// ─── App Init ────────────────────────────────────────────────────────────────

const app = express();

// ─── Webhook Route (raw body — MUST be before express.json()) ────────────────

app.use(
  "/api/webhooks/clerk",
  express.raw({ type: "application/json" }),
  clerkWebhook
);

// ─── Core Middleware ─────────────────────────────────────────────────────────

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(
  clerkMiddleware({
    secretKey: process.env.CLERK_SECRET_KEY,
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
  })
);

// ─── Health Check ─────────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/auth/check", authRoutes )

// ─── Static Files (production build) ─────────────────────────────────────────

if (fs.existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR));
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "index.html"));
  });
}

// ─── 404 Handler ─────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error("[Server Error]", err);
  res.status(err.status ?? 500).json({
    error:
      NODE_ENV === "production"
        ? "Internal server error"
        : err.message,
  });
});

// ─── Bootstrap ───────────────────────────────────────────────────────────────

const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.info(`[Server] Running on port ${PORT} (${NODE_ENV})`);
      if (!FRONTEND_URL) {
        console.warn("[Server] WARNING: FRONTEND_URL is not set — CORS may block requests");
      }
    });
  } catch (error) {
    console.error("[Server] Failed to start:", error);
    process.exit(1); // unrecoverable — process বন্ধ করো
  }
};

// Unhandled promise rejection গুলো catch করো
process.on("unhandledRejection", (reason) => {
  console.error("[Process] Unhandled Promise Rejection:", reason);
});

// Uncaught exception গুলো catch করো
process.on("uncaughtException", (err) => {
  console.error("[Process] Uncaught Exception:", err);
  process.exit(1);
});

startServer();


export default app;
import express from "express";
import cors from "cors";
import "dotenv/config"; 
import fs from "fs";
import path from "path";
import "./lib/cron.js";
import { connectDB } from "./db.js";
import { clerkMiddleware } from '@clerk/express';

import clerkWebhook from "./webhooks/clerk.webhook.js";

const PORT = process.env.PORT || 3000;
const publicDir = path.join(process.cwd(), "public");

const app = express();

app.use("/api/webhooks/clerk", express.raw({ type: "application/json" }), clerkWebhook );
app.use(express.json());
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));

app.use(clerkMiddleware({
  secretKey: process.env.CLERK_SECRET_KEY,
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY
}));

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });
}

const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
  }
};

startServer();

export default app;
import express from "express";
import cors from "cors";
import dotenv from "dotenv/config.js";
import { connectDB } from "./db.js";
import { clerkMiddleware } from '@clerk/express'

const PORT = process.env.PORT || 3000;
const dbUri = process.env.DB_URL;
const frontendUrl = process.env.FRONTEND_URL;

const app = express();
app.use(express.json());
app.use(cors({ origin: frontendUrl, credentials: true }));
app.use(clerkMiddleware());

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.listen(PORT, () => connectDB(), console.log("Server is running on port", PORT, dbUri));


export default app;

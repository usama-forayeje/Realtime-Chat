import express from "express";
import User from "../models/user.model.js";
import { verifyWebhook } from "@clerk/backend/webhooks";

const router = express.Router();

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractPrimaryEmail(userData) {
  const { email_addresses, primary_email_address_id } = userData;
  if (!email_addresses?.length) return null;

  const primary = email_addresses.find(
    (e) => e.id === primary_email_address_id
  );
  return (primary ?? email_addresses[0])?.email_address ?? null;
}

function buildFullName(userData, email) {
  const { first_name, last_name, username } = userData;
  const fromName = [first_name, last_name].filter(Boolean).join(" ").trim();
  return fromName || username || (email ? email.split("@")[0] : "Unknown");
}

// ─── Webhook Handler ─────────────────────────────────────────────────────────

router.post("/api/webhooks/clerk", async (req, res) => {
  // 1. Signing secret চেক
  const signingSecret = process.env.CLERK_WEBHOOK_SIGNING_KEY;
  if (!signingSecret) {
    console.error("[Clerk Webhook] CLERK_WEBHOOK_SIGNING_KEY is not set");
    return res.status(500).json({ error: "Server configuration error" });
  }

  // 2. Signature verify
  let evt;
  try {
    const payload = Buffer.isBuffer(req.body)
      ? req.body.toString("utf-8")
      : String(req.body);

    const syntheticRequest = new Request("http://internal/webhooks/clerk", {
      method: "POST",
      headers: new Headers(req.headers),
      body: payload,
    });

    evt = await verifyWebhook(syntheticRequest, signingSecret);
  } catch (err) {
    console.warn("[Clerk Webhook] Signature verification failed:", err.message);
    return res.status(400).json({ error: "Invalid webhook signature" });
  }

  const { type: eventType, data } = evt;
  console.info(`[Clerk Webhook] Received event: ${eventType}`);

  // 3. Event handle
  try {
    if (eventType === "user.created" || eventType === "user.updated") {
      const email = extractPrimaryEmail(data);
      if (!email) {
        console.warn(
          `[Clerk Webhook] No email found for user ${data.id} — skipping upsert`
        );
        return res.status(200).json({ message: "Skipped: no email address" });
      }

      const fullName = buildFullName(data, email);

      const updatedUser = await User.findOneAndUpdate(
        { clerkId: data.id },
        {
          $set: {
            clerkId: data.id,
            email,
            fullName,
            profilePic: data.image_url ?? null,
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      console.info(
        `[Clerk Webhook] User ${eventType === "user.created" ? "created" : "updated"}: ${updatedUser._id}`
      );
      return res.status(200).json({ success: true, userId: updatedUser._id });
    }

    if (eventType === "user.deleted") {
      if (!data.id) {
        console.warn("[Clerk Webhook] user.deleted event missing data.id");
        return res.status(400).json({ error: "Missing user ID in payload" });
      }

      const deleted = await User.findOneAndDelete({ clerkId: data.id });
      if (deleted) {
        console.info(`[Clerk Webhook] User deleted: ${deleted._id}`);
      } else {
        console.warn(
          `[Clerk Webhook] user.deleted fired but no DB record found for clerkId: ${data.id}`
        );
      }
      return res.status(200).json({ success: true });
    }

    // Unhandled event types — 200 দিয়ে acknowledge করো, নয়তো Clerk retry করবে
    console.info(`[Clerk Webhook] Unhandled event type: ${eventType}`);
    return res.status(200).json({ message: "Event acknowledged but not processed" });

  } catch (err) {
    console.error(`[Clerk Webhook] DB operation failed for event ${eventType}:`, err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
import mongoose from "mongoose";
import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import { uploadChatMedia } from "../lib/imagekit.js";
import { getUserSocketId, io } from "../lib/socket.js";
import { getFileCategory } from "../middlewares/upload.middleware.js";

// ─── All Users (sidebar search) ───────────────────────────────────────────────

export async function getUsersForSidebar(req, res) {
  try {
    const loggedInUserId = req.user._id;

    const users = await User.find({ _id: { $ne: loggedInUserId } })
      .select("-clerkId")
      .lean();

    res.status(200).json(users);
  } catch (error) {
    console.error("[getUsersForSidebar]", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ─── Recent Conversations (sidebar list) ─────────────────────────────────────

export async function getConversationsForSidebar(req, res) {
  try {
    const loggedInUserId = req.user._id;

    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [
            { senderId: loggedInUserId },
            { receiverId: loggedInUserId },
          ],
        },
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ["$senderId", loggedInUserId] },
              "$receiverId",
              "$senderId",
            ],
          },
          lastMessageAt: { $max: "$createdAt" },
          lastMessage: { $last: "$text" },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$receiverId", loggedInUserId] },
                    { $eq: ["$isRead", false] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { lastMessageAt: -1 } },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "userInfo",
        },
      },
      { $unwind: "$userInfo" },
      {
        $project: {
          _id: "$userInfo._id",
          fullName: "$userInfo.fullName",
          email: "$userInfo.email",
          profilePic: "$userInfo.profilePic",
          lastMessageAt: 1,
          lastMessage: 1,
          unreadCount: 1,
        },
      },
    ]);

    res.status(200).json(conversations);
  } catch (error) {
    console.error("[getConversationsForSidebar]", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ─── Get Messages (chat window) ───────────────────────────────────────────────

export async function getMessages(req, res) {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user._id;

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    }).sort({ createdAt: 1 });

    // message গুলো read হিসেবে mark করো
    await Message.updateMany(
      { senderId: userToChatId, receiverId: myId, isRead: false },
      { $set: { isRead: true } }
    );

    res.status(200).json(messages);
  } catch (error) {
    console.error("[getMessages]", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ─── Send Message ─────────────────────────────────────────────────────────────

export async function sendMessage(req, res) {
  try {
    const { id: receiverId } = req.params;
    const senderId = req.user._id;
    const { text } = req.body;
    const files = req.files ?? [];

    // text বা file — অন্তত একটা লাগবে
    if (!text?.trim() && files.length === 0) {
      return res.status(400).json({ error: "Message text or file is required" });
    }

    // receiver exist করে কিনা চেক করো
    const receiverExists = await User.exists({ _id: receiverId });
    if (!receiverExists) {
      return res.status(404).json({ error: "Receiver not found" });
    }

    // ─── File Upload ──────────────────────────────────────────────────────────

    // প্রতিটা file ImageKit এ upload করো, result save করো
    const uploadedAttachments = await Promise.all(
      files.map(async (file) => {
        const result = await uploadChatMedia(file);
        return {
          url: result.url,
          fileId: result.fileId,       // delete করার জন্য save করো
          name: result.name,
          size: result.size,
          fileType: getFileCategory(file.mimetype), // image/video/audio/file
          mimeType: file.mimetype,
        };
      })
    );

    // ─── Save Message ─────────────────────────────────────────────────────────

    const newMessage = await Message.create({
      senderId,
      receiverId,
      text: text?.trim() ?? "",
      attachments: uploadedAttachments,
      isRead: false,
    });

    // ─── Realtime Emit ────────────────────────────────────────────────────────

    const receiverSocketId = getUserSocketId(receiverId.toString());
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }

    res.status(201).json(newMessage);
  } catch (error) {
    console.error("[sendMessage]", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ─── Mark Messages as Read ────────────────────────────────────────────────────

export async function markMessagesAsRead(req, res) {
  try {
    const { id: senderId } = req.params;
    const receiverId = req.user._id;

    await Message.updateMany(
      { senderId, receiverId, isRead: false },
      { $set: { isRead: true } }
    );

    // sender কে জানাও যে তার message পড়া হয়েছে
    const senderSocketId = getUserSocketId(senderId.toString());
    if (senderSocketId) {
      io.to(senderSocketId).emit("messagesRead", { by: receiverId });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("[markMessagesAsRead]", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
}
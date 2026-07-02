import mongoose from "mongoose";
import User from "../models/user.model.js";
import Message from "../models/message.model.js";

// ─── All Users (for sidebar search) ───────────────────────────────────────

export async function getUsersForSidebar(req, res) {
  try {
    const loggedInUserId = req.user._id;

    const users = await User.find({ _id: { $ne: loggedInUserId } })
      .select("-clerkId")
      .lean(); // plain JS object — faster

    res.status(200).json(users);
  } catch (error) {
    console.error("[getUsersForSidebar]", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ─── Recent Conversations (for sidebar list) ─────────────────────────────

export async function getConversationsForSidebar(req, res) {
  try {
    const loggedInUserId = req.user._id; // ✅ consistent variable name

    const conversations = await Message.aggregate([
      // Step 1: আমি যেসব message এ involved (sender বা receiver)
      {
        $match: {
          $or: [{ senderId: loggedInUserId }, { receiverId: loggedInUserId }],
        },
      },

      // Step 2: conversation partner কে group করো
      // আমি sender হলে → partner = receiverId
      // আমি receiver হলে → partner = senderId
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

      // Step 3: সবচেয়ে নতুন conversation আগে দেখাও
      {
        $sort: { lastMessageAt: -1 },
      },

      // Step 4: partner এর user info নিয়ে আসো (JOIN)
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "userInfo",
        },
      },

      // Step 5: userInfo array থেকে প্রথম element বের করো
      {
        $unwind: "$userInfo",
      },

      // Step 6: final shape তৈরি করো
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

// Get all messages between logged-in user and a specific user (for chat window)
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

    res.status(200).json(messages);
  } catch (error) {
    console.error("[getMessages]", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
}

//  Send a message to a specific user
export async function sendMessage(req, res) {
  try {
    const { id: receiverId } = req.params;
    const senderId = req.user._id;
    const { text } = req.body;
    const files = req.files; // Access uploaded files

    let imageUrls = [];
    let videoUrls = [];
    if (req.files && req.files.length > 0) {
      imageUrls = req.files
        .filter((file) => file.mimetype.startsWith("image/"))
        .map((file) => file.path);
      videoUrls = req.files
        .filter((file) => file.mimetype.startsWith("video/"))
        .map((file) => file.path);

      const url = (uploadedFiles = req.files.map((file) => ({
        filename: file.originalname,

        url: file.path,
        mimetype: file.mimetype,
        size: file.size,
      })));
    }

    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      imageUrls,
      videoUrls,
    });
  } catch (error) {
    console.error("[sendMessage]", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
}

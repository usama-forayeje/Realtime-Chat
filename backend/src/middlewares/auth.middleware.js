import {getAuth} from "@clerk/express";
import User from "../models/user.model.js"

export async function protectRoute(req, res, next) {
  try {
    const {userId} = getAuth(req);

    if (!userId) {
      return res.status(401).json({error: "Unauthorized"});
    }

    const user = await User.findOne({clerkId: userId});
    if (!user) {
      return res.status(401).json({error: "User not found"});
    }
    
    req.user = user;
    next();
  } catch (error) {
    res.status(500).json({error: error.message});
    console.error("[Auth Middleware] Error:", error);
  }
}
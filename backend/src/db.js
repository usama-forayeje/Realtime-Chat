import mongoose from "mongoose";

export async function connectDB() {
  try {
    const mongoURI = process.env.DB_URL;

    if (!mongoURI) {
      throw new Error("DB_URL is not defined in the environment variables");
    }

    const conn = await mongoose.connect(mongoURI);
    console.log("Connected to MongoDB" + conn.connection.host);
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    process.exit(1);
  }
}

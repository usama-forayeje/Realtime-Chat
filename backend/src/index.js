import express from "express";
import dotenv from "dotenv/config.js";

const PORT = process.env.PORT || 3000;
const dbUri = process.env.DB_URI;

const app = express();

app.listen(PORT, () => console.log("Server is running on port", PORT, dbUri));


export default app;
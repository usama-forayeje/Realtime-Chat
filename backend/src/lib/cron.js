import { CronJob } from "cron";
import http from "node:http";
import https from "node:https";

if (process.env.NODE_ENV === 'production') {
  const job = new CronJob("*/14 * * * *", function () {
    const base = process.env.FRONTEND_URL;
    if (!base) return;

    const url = new URL("/health", base).href;
    const client = url.startsWith("https") ? https : http;

    client
      .get(url, (res) => {
        if (res.statusCode === 200) console.log("Keep-alive ping successful");
      })
      .on("error", (err) => {
        console.error("Keep-alive ping failed:", err.message);
      });
  });

  job.start();
  console.log("Cron Job started for Production Keep-Alive.");
} else {
  console.log("Cron Job skipped: Not in production environment.");
}
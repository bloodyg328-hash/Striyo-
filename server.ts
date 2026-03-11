import express from "express";
import { createServer as createViteServer } from "vite";
import os from "os";
import twilio from "twilio";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Real System Stats API
  app.get("/api/stats", (req, res) => {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const ramUsage = Math.round((usedMem / totalMem) * 100);
    
    const load = os.loadavg()[0];
    const cpuUsage = Math.min(100, Math.round((load / os.cpus().length) * 100));

    res.json({
      cpu: cpuUsage,
      ram: ramUsage,
      uptime: os.uptime(),
      platform: os.platform(),
      arch: os.arch()
    });
  });

  // Real Messaging API (Twilio Integration)
  app.post("/api/message", async (req, res) => {
    const { contact, message, type } = req.body;
    
    const accountSid = process.env.TWILIO_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (accountSid && authToken && fromNumber) {
      try {
        const client = twilio(accountSid, authToken);
        await client.messages.create({
          body: message,
          from: fromNumber,
          to: contact
        });
        res.json({ success: true, status: "sent" });
      } catch (error: any) {
        console.error("Twilio Error:", error);
        res.status(500).json({ success: false, error: error.message });
      }
    } else {
      console.log(`[MOCK MESSAGE - Keys Missing] Sending ${type} to ${contact}: ${message}`);
      res.json({ success: true, status: "mock_sent", warning: "Twilio keys missing" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile("dist/index.html", { root: "." });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`STRIYO Server running on http://localhost:${PORT}`);
  });
}

startServer();

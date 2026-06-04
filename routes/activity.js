// routes/activity.js (CommonJS)
const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { logActivity } = require("../lib/activityLogger");
// (geo lookup code kept the same or you can keep ipapi logic)

const router = express.Router();

router.post("/log", async (req, res) => {
  try {
    // server IP extraction
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.connection.remoteAddress;

    // If client sent sessionId, prefer it. Otherwise check cookie. If none, generate.
    let sessionId = req.body?.sessionId || req.cookies?.sessionId;
    if (!sessionId) {
      sessionId = uuidv4();
      // Set cookie so future requests from same browser include it (optional)
      // Note: cookie is httpOnly — not accessible to JS. If you want JS to read it, set httpOnly: false.
      res.cookie("sessionId", sessionId, {
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
        sameSite: "Lax", // adjust
        // secure: true // enable when using HTTPS in production
      });
    }

    // do geo lookup (your existing code). If fetch not available on node version, use node-fetch or geoip-lite
    let country = null;
    // ... your existing geo code (or keep country=null for local dev)

    const event = {
      ...req.body,
      sessionId,
      ip,
      country,
    };

    console.log("📩 Incoming activity:", event);

    const insertedId = await logActivity(event);
    // return sessionId so you can confirm it from Postman during testing
    res.json({ success: true, insertedId, sessionId, event });
  } catch (err) {
    console.error("❌ Error logging activity:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

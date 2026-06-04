// lib/activityLogger.js
const pool = require("./db");

/**
 * Log an activity event into the database
 * @param {Object} event - activity event payload
 * @returns {Number} insertedId - the primary key id of the inserted row
 */
async function logActivity(event) {
  const sessionId = event.sessionId || null;
  const path = event.path || null;
  const eventType = event.eventType || null;
  const eventTime = event.eventTime || new Date();
  const userAgent = event.userAgent || null;
  const screenWidth = event.screenWidth || null;
  const screenHeight = event.screenHeight || null;
  const referrer = event.referrer || null;

  // safely stringify JSON fields (prevent errors if null/undefined)
  const utm = event.utm ? JSON.stringify(event.utm) : "{}";
  const eventData = event.eventData ? JSON.stringify(event.eventData) : "{}";
  const meta = event.meta ? JSON.stringify(event.meta) : "{}";

  const country = event.country || null;
  const ip = event.ip || null;

  try {
    const [rows] = await pool.query(
      `INSERT INTO activity_events
       (sessionId, path, eventType, eventTime, userAgent, screenWidth, screenHeight, referrer, utm, eventData, meta, country, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionId,
        path,
        eventType,
        eventTime,
        userAgent,
        screenWidth,
        screenHeight,
        referrer,
        utm,
        eventData,
        meta,
        country,
        ip,
      ]
    );

    return rows.insertId;
  } catch (err) {
    console.error("❌ Error inserting activity:", err.message);
    throw err;
  }
}

module.exports = { logActivity };

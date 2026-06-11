// routes/mobileppcheroform.js
const express = require("express");
const router = express.Router();
const db = require("../db"); // your DB connection
const sendEmail = require("../utils/sendEmailGraph"); // your email util
require("dotenv").config();

// POST /api/mobileppcheroform
router.post("/", (req, res) => {
  const brandConfig = req.brandConfig;
  console.log("📩 New request received at /api/mobileppcheroform");
  const { name, email, phone, message } = req.body;
  console.log("➡️ Form data received:", { name, email, phone, message });

  // ✅ Basic validation
  if (!name || !email || !phone || !message) {
    console.warn("⚠️ Missing required fields");
    return res.status(400).json({ error: "Missing required fields" });
  }

  // ✅ Save to database
  db.getConnection((connErr, connection) => {
    if (connErr) {
      console.error("❌ DB Connection Error:", connErr);
      return res.status(500).json({ error: "Database connection error" });
    }

    console.log("✅ Database connection established");

    const query = `
      INSERT INTO mobile_ppc_requests (name, email, phone, message)
      VALUES (?, ?, ?, ?)
    `;
    const values = [name, email, phone, message];

    console.log("📝 Running query:", query);
    console.log("📊 With values:", values);

    connection.query(query, values, async (err) => {
      connection.release();

      if (err) {
        console.error("❌ DB Insert Error:", err);
        return res.status(500).json({ error: "Database insert failed" });
      }

      console.log("✅ Data inserted into mobile_ppc_requests");

      try {
        // 1️⃣ Email to admin
        const adminMail = {
          from: `"${brandConfig.name}" <${process.env.EMAIL_USER}>`,
          to: brandConfig.receiver,
          subject: "📩 New Mobile App Development PPC Hero Form Submission",
          html: `
            <h3>New Submission Received</h3>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Phone:</strong> ${phone}</p>
            <p><strong>Message:</strong> ${message}</p>
          `,
        };
        await sendEmail(adminMail);
        console.log(`📨 Admin notified: ${process.env.EMAIL_RECEIVER}`);

        // 2️⃣ Confirmation email to user
        const userMail = {
          from: `"${brandConfig.name}" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: "Thanks for contacting us!",
          html: `
           <div style="font-family: Helvetica, Arial, sans-serif; font-size: 16px; color: #333;">
            <p>Hi ${name},</p>
            <p>Thanks for reaching out to <strong>Optimal IT Solutions!</strong> We’re excited to bring your vision to life. One of our team members will connect with you within 24 hours to discuss your goals and next steps.</p>
            <p>In the meantime, you can visit us at <a href="https://optimal-itsolutions.com"> www.optimal-itsolutions.com </a> or call us at <a href="tel:8887106350"> +1 888-710-6350 </a> anytime.</p>
            <p>Best,</p>
            <p><strong>Team Optimal IT Solutions</strong></p>
          </div>  
          `,
        };
        await sendEmail(userMail);
        console.log(`📨 Confirmation email sent to user: ${email}`);

        // ✅ Send success response
        console.log("✅ All steps completed successfully");
        return res.status(200).json({ redirectUrl: "/thank-you" });
      } catch (emailErr) {
        console.error("❌ Email Sending Error:", emailErr);
        return res.status(500).json({ error: "Email sending failed" });
      }
    });
  });
});

module.exports = router;

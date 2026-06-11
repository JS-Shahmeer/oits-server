// routes/thirdform.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const sendEmail = require("../utils/sendEmailGraph");
require("dotenv").config();

router.post("/", (req, res) => {
  try {
    const brandConfig = req.brandConfig;
    const { fullName, email, phone, country, message, privacy, services } =
      req.body;

    // ✔ Only require fullName, email, phone
    if (!fullName || !email || !phone) {
      return res
        .status(400)
        .json({ error: "Full name, email, and phone are required." });
    }

    // Optional fields
    const countryVal = country || null;
    const messageVal = message || null;
    const privacyVal = privacy || null;
    const servicesStr = Array.isArray(services) ? services.join(", ") : null;

    // Insert into DB
    const sql = `
      INSERT INTO third_form_submissions 
      (full_name, email, phone, country, message, services, privacy) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
      fullName,
      email,
      phone,
      countryVal,
      messageVal,
      servicesStr,
      privacyVal,
    ];

    db.query(sql, values, async (err) => {
      if (err) {
        console.error("❌ DB Insert Error:", err);
        return res.status(500).json({ error: "Database error." });
      }

      try {
        // 1️⃣ Email to admin
        const adminMail = {
          from: `"${brandConfig.name}" <${process.env.EMAIL_USER}>`,
          to: brandConfig.receiver,
          subject: `New Service Inquiry - ${brandConfig.name}`,
          html: `
            <h3>New Service Inquiry Submission</h3>
            <p><strong>Full Name:</strong> ${fullName}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Phone:</strong> ${phone}</p>
            <p><strong>Country:</strong> ${country}</p>
            <p><strong>Services:</strong> ${servicesStr}</p>
            <p><strong>Message:</strong> ${message}</p>
          `,
        };
        await sendEmail(adminMail);
        console.log(`✅ Admin notified about service inquiry from ${fullName}`);

        // Log admin email
        const logSql = `
          INSERT INTO sent_email_logs (recipient_email, subject, body)
          VALUES (?, ?, ?)
        `;
        db.query(
          logSql,
          [adminMail.to, adminMail.subject, adminMail.html],
          (err) => {
            if (err) console.error("Error logging sent email:", err);
          }
        );

        // 2️⃣ Confirmation email to user
        const userMail = {
          from: `"${brandConfig.name}" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: "Thanks for signing up!",
          html: `
          <div style="font-family: Helvetica, Arial, sans-serif; font-size: 16px; color: #333;">
            <p> Hi ${fullName}</p>
            <p>Thanks for reaching out to <strong>Optimal IT Solutions!</strong> We’re excited to bring your ${servicesStr} vision to life. One of our team members will connect with you within 24 hours to discuss your goals and next steps.</p>
            <p>In the meantime, you can visit us at <a href="https://optimal-itsolutions.com"> www.optimal-itsolutions.com </a> or call us at <a href="tel:8887106350"> +1 888-710-6350 </a> anytime.</p>
            <p>Best,</p>
            <p><strong>Team Optimal IT Solutions</strong></p>
          </div>  
            `,
        };
        await sendEmail(userMail);
        console.log(`✅ Confirmation email sent to ${email}`);

        // Log user confirmation email
        db.query(
          logSql,
          [userMail.to, userMail.subject, userMail.html],
          (err) => {
            if (err) console.error("Error logging sent email:", err);
          }
        );

        return res.status(200).json({
          success: true,
          message: "Submission saved and emails sent.",
        });
      } catch (emailErr) {
        console.error("❌ Email Error:", emailErr);
        return res.status(500).json({ error: "Email sending failed" });
      }
    });
  } catch (err) {
    console.error("❌ Server Error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

module.exports = router;

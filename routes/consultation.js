const express = require("express");
const router = express.Router();
const multer = require("multer");
const db = require("../db");
const sendEmail = require("../utils/sendEmailGraph");

const upload = multer({ storage: multer.memoryStorage() });

router.post("/", upload.single("file"), (req, res) => {
  const { fullName, email, country, number, message, privacy } = req.body;
  const file = req.file;

  if (!fullName || !email || !country || !number || !message || !privacy) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  db.getConnection((connErr, connection) => {
    if (connErr) {
      console.error("Connection Error:", connErr);
      return res.status(500).json({ error: "Database connection error" });
    }

    const query = `
      INSERT INTO consultations (fullName, email, country, number, message, file)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const values = [
      fullName,
      email,
      country,
      number,
      message,
      file ? file.originalname : null,
    ];

    connection.query(query, values, async (err) => {
      connection.release();

      if (err) {
        console.error("DB Error:", err);
        return res.status(500).json({ error: "Database insert failed" });
      }

      try {
        // 1️⃣ Email to Admin
        const adminMailOptions = {
          to: process.env.EMAIL_RECEIVER,
          subject: "New Consultation Request",
          html: `
            <h3>New Consultation Submission</h3>
            <p><strong>Name:</strong> ${fullName}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Country:</strong> ${country}</p>
            <p><strong>Number:</strong> ${number}</p>
            <p><strong>Message:</strong> ${message}</p>
          `,
          attachments: file
            ? [
                {
                  filename: file.originalname,
                  content: file.buffer,
                },
              ]
            : [],
        };
        await sendEmail(adminMailOptions);
        console.log(`✅ Admin email sent to ${process.env.EMAIL_RECEIVER}`);

        // ✅ Log admin email
        const logAdminSql = `
          INSERT INTO sent_email_logs (recipient_email, subject, body)
          VALUES (?, ?, ?)
        `;
        db.query(
          logAdminSql,
          [
            adminMailOptions.to,
            adminMailOptions.subject,
            adminMailOptions.html,
          ],
          (logErr) => {
            if (logErr) console.error("Error logging admin email:", logErr);
          }
        );

        // 2️⃣ Confirmation email to User
        const userMailOptions = {
          to: email,
          subject: "Thanks for signing up!",
          html: `
          <div style="font-family: Helvetica, Arial, sans-serif; font-size: 16px; color: #333;">
            <p> Hi ${fullName}</p>
            <p>Thanks for reaching out to <strong>Optimal IT Solutions!</strong> We’re excited to bring your  vision to life. One of our team members will connect with you within 24 hours to discuss your goals and next steps.</p>
            <p>In the meantime, you can visit us at <a href="https://optimal-itsolutions.com"> www.optimal-itsolutions.com </a> or call us at <a href="tel:8887106350"> +1 888-710-6350 </a> anytime.</p>
            <p>Best,</p>
            <p><strong>Team Optimal IT Solutions</strong></p>
          </div>
            `,
        };
        await sendEmail(userMailOptions);
        console.log(`✅ Confirmation email sent to ${email}`);

        // ✅ Log user email
        const logUserSql = `
          INSERT INTO sent_email_logs (recipient_email, subject, body)
          VALUES (?, ?, ?)
        `;
        db.query(
          logUserSql,
          [userMailOptions.to, userMailOptions.subject, userMailOptions.html],
          (logErr) => {
            if (logErr) console.error("Error logging user email:", logErr);
          }
        );

        res
          .status(200)
          .json({ message: "Consultation submitted successfully" });
      } catch (emailErr) {
        console.error("Email Error:", emailErr);
        return res.status(500).json({ error: "Email sending failed" });
      }
    });
  });
});

module.exports = router;

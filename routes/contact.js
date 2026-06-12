const express = require("express");
const router = express.Router();
const multer = require("multer");
const db = require("../db");
const sendEmail = require("../utils/sendEmailGraph");
const {
  validateBrand,
  getConfirmationHtml,
} = require("../utils/brandConfig");
require("dotenv").config();

const upload = multer({ storage: multer.memoryStorage() });

// POST /api/contact
router.post("/", upload.single("file"), (req, res) => {
  const {
    fullName,
    email,
    phone,
    services,
    comments,
    message,
    country,
  } = req.body;
  const file = req.file;
  const brandConfig = validateBrand(req, res);
  const submittedComments = comments || message || null;

  if (!brandConfig) return;

  if (!fullName || !email || !phone) {
    return res
      .status(400)
      .json({ error: "Full name, email, and phone are required" });
  }

  db.getConnection((connErr, connection) => {
    if (connErr) {
      console.error("Connection Error:", connErr);
      return res.status(500).json({ error: "Database connection error" });
    }

    const query = `
      INSERT INTO contacts
        (name, email, phone, country, services, comments, file, brand)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
      fullName,
      email,
      phone,
      country || null,
      services || null,
      submittedComments,
      file ? file.originalname : null,
      brandConfig.key,
    ];

    connection.query(query, values, async (err) => {
      connection.release();

      if (err) {
        console.error("DB Error:", err);
        return res.status(500).json({ error: "Database error" });
      }

      try {
        const adminMailOptions = {
          from: `"${brandConfig.name}" <${brandConfig.senderEmail}>`,
          to: brandConfig.receiver,
          subject: `New Contact Form Submission - ${brandConfig.name}`,
          html: `
            <h3>New Contact Request</h3>
            <p><strong>Brand:</strong> ${brandConfig.name}</p>
            <p><strong>Name:</strong> ${fullName}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Phone:</strong> ${phone}</p>
            <p><strong>Country:</strong> ${country || ""}</p>
            <p><strong>Services:</strong> ${services || ""}</p>
            <p><strong>Comments:</strong> ${submittedComments || ""}</p>
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
        console.log(`Admin email sent to ${brandConfig.receiver}`);

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

        const userMailOptions = {
          from: `"${brandConfig.name}" <${brandConfig.senderEmail}>`,
          to: email,
          subject: "Thanks for signing up!",
          html: getConfirmationHtml(brandConfig, fullName, services),
        };
        await sendEmail(userMailOptions);
        console.log(`Confirmation email sent to ${email}`);

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

        return res.status(200).json({ message: "Form submitted successfully" });
      } catch (emailErr) {
        console.error("Email Error:", emailErr);
        return res.status(500).json({ error: "Email sending failed" });
      }
    });
  });
});

module.exports = router;

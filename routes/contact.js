const express = require("express");
const router = express.Router();
const multer = require("multer");
const db = require("../db");
const sendEmail = require("../utils/sendEmailGraph");
require("dotenv").config();

const upload = multer({ storage: multer.memoryStorage() });

const parseList = (value) =>
  (value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

const BRAND_CONFIG = {
  optimal: {
    name: "Optimal IT Solutions",
    receiver:
      process.env.OPTIMAL_EMAIL_RECEIVER || process.env.EMAIL_RECEIVER,
    website: "https://optimal-itsolutions.com",
    phone: "+1 888-710-6350",
    domains: ["optimal-itsolutions.com", "www.optimal-itsolutions.com"],
  },
  "digital-paradigm": {
    name: "Digital Paradigm",
    receiver: process.env.DIGITAL_PARADIGM_EMAIL_RECEIVER,
    website: process.env.DIGITAL_PARADIGM_WEBSITE,
    phone: process.env.DIGITAL_PARADIGM_PHONE,
    domains: parseList(process.env.DIGITAL_PARADIGM_DOMAINS),
  },
};

function getRequestHostname(req) {
  const sourceUrl = req.get("origin") || req.get("referer");

  if (!sourceUrl) return null;

  try {
    return new URL(sourceUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function detectBrand(req, requestedBrand) {
  const hostname = getRequestHostname(req);

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return BRAND_CONFIG[requestedBrand] ? requestedBrand : "optimal";
  }

  const matchedBrand = Object.entries(BRAND_CONFIG).find(([, config]) =>
    config.domains.includes(hostname)
  );

  if (matchedBrand) return matchedBrand[0];

  // Retain body support for Postman and other non-browser clients.
  return BRAND_CONFIG[requestedBrand] ? requestedBrand : null;
}

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
    brand: requestedBrand,
  } = req.body;
  const file = req.file;
  const brand = detectBrand(req, requestedBrand);
  const brandConfig = BRAND_CONFIG[brand];
  const submittedComments = comments || message || null;

  if (!brandConfig) {
    return res
      .status(400)
      .json({ error: "Unable to detect brand from request domain" });
  }

  if (!fullName || !email || !phone) {
    return res
      .status(400)
      .json({ error: "Full name, email, and phone are required" });
  }

  if (!brandConfig.receiver) {
    console.error(`Missing email receiver configuration for brand: ${brand}`);
    return res.status(500).json({ error: "Email receiver is not configured" });
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
      brand,
    ];

    connection.query(query, values, async (err) => {
      connection.release();

      if (err) {
        console.error("DB Error:", err);
        return res.status(500).json({ error: "Database error" });
      }

      try {
        const adminMailOptions = {
          from: `"${brandConfig.name}" <${process.env.EMAIL_USER}>`,
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
          from: `"${brandConfig.name}" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: "Thanks for signing up!",
          html: `
            <div style="font-family: Helvetica, Arial, sans-serif; font-size: 16px; color: #333;">
              <p>Hi ${fullName}</p>
              <p>Thanks for reaching out to <strong>${brandConfig.name}!</strong> We're excited to bring your ${services || ""} vision to life. One of our team members will connect with you within 24 hours to discuss your goals and next steps.</p>
              <p>In the meantime, you can visit us at <a href="${brandConfig.website}">${brandConfig.website}</a> or call us at ${brandConfig.phone} anytime.</p>
              <p>Best,</p>
              <p><strong>Team ${brandConfig.name}</strong></p>
            </div>
          `,
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

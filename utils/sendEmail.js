const nodemailer = require("nodemailer");
require("dotenv").config();

async function sendEmail({ to, subject, html, attachments = [] }) {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST, // smtp.office365.com
    port: parseInt(process.env.EMAIL_PORT, 10), // 587 for TLS
    secure: false, // Always false for Office 365 (465 is not supported)
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false, // Helps avoid self-signed cert issues
    },
  });

  const mailOptions = {
    from: `"Optimal IT Solutions" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
    attachments,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent:", info.messageId);
    return info;
  } catch (error) {
    console.error("❌ Email sending failed:", error);
    throw error;
  }
}

module.exports = sendEmail;

const fs = require('fs');
const path = require('path');
const { format } = require('@fast-csv/format');
const db = require('../db');
const sendEmail = require('../utils/sendEmailGraph');

async function runReportEmails() {
    try {
        // Fetch unreported emails from last 12 hours
        const [rows] = await db.promise().query(`
            SELECT id, recipient_email, subject, body, sent_at
            FROM sent_email_logs
            WHERE reported = 0
              AND sent_at >= NOW() - INTERVAL 12 HOUR
        `);

        if (!rows.length) {
            console.log("No new emails to report.");
            return;
        }

        // Generate CSV file
        const filePath = path.join(__dirname, 'email_report.csv');
        const ws = fs.createWriteStream(filePath);
        const csvStream = format({ headers: true });

        csvStream.pipe(ws);
        rows.forEach(row => {
            csvStream.write({
                Recipient: row.recipient_email,
                Subject: row.subject,
                Body: row.body,
                SentAt: row.sent_at
            });
        });
        csvStream.end();

        await new Promise(resolve => ws.on('finish', resolve));

        // Send CSV to sales email
        await sendEmail({
            to: 'sales@optimal-itsolutions.com',
            subject: '12-Hour Email Report',
            text: 'Attached is the email report for the last 12 hours.',
            attachments: [
                {
                    filename: 'email_report.csv',
                    path: filePath
                }
            ]
        });

        // Mark reported emails in DB
        const ids = rows.map(r => r.id);
        await db.promise().query(
            `UPDATE sent_email_logs SET reported = 1 WHERE id IN (?)`,
            [ids]
        );

        console.log("✅ Report sent and DB updated.");
    } catch (err) {
        console.error("❌ Error in report job:", err);
    }
}

module.exports = runReportEmails;

const { Client } = require("@microsoft/microsoft-graph-client");
const { ClientSecretCredential } = require("@azure/identity");
require("isomorphic-fetch");
require("dotenv").config();

function getFromName(from) {
  if (!from) return undefined;

  const match = from.match(/^"?([^"<]+)"?\s*</);
  return match ? match[1].trim() : undefined;
}

function toGraphAttachments(attachments = []) {
  return attachments.map((attachment) => ({
    "@odata.type": "#microsoft.graph.fileAttachment",
    name: attachment.filename,
    contentType: attachment.contentType || "application/octet-stream",
    contentBytes: Buffer.isBuffer(attachment.content)
      ? attachment.content.toString("base64")
      : attachment.content,
  }));
}

async function sendEmailGraph({
  from,
  to,
  subject,
  html,
  attachments = [],
}) {
  if (!to || !to.includes("@")) {
    throw new Error("Invalid recipient email address provided");
  }

  const credential = new ClientSecretCredential(
    process.env.TENANT_ID,
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET
  );

  const token = await credential.getToken("https://graph.microsoft.com/.default");

  const client = Client.init({
    authProvider: (done) => {
      done(null, token.token);
    },
  });

  const message = {
    subject,
    body: {
      contentType: "HTML",
      content: html,
    },
    toRecipients: [
      {
        emailAddress: {
          address: to,
        },
      },
    ],
  };

  const fromName = getFromName(from);
  if (fromName) {
    message.from = {
      emailAddress: {
        name: fromName,
        address: process.env.EMAIL_USER,
      },
    };
  }

  if (attachments.length > 0) {
    message.attachments = toGraphAttachments(attachments);
  }

  await client
    .api(`/users/${process.env.EMAIL_USER}/sendMail`)
    .post({ message, saveToSentItems: true });

  console.log(`Email sent to ${to}`);
}

module.exports = sendEmailGraph;

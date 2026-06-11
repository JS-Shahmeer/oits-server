const { Client } = require("@microsoft/microsoft-graph-client");
const { ClientSecretCredential } = require("@azure/identity");
const {
  getCurrentBrandConfig,
  getBrandConfigByName,
} = require("./brandConfig");
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

function applyBrandToMail(options) {
  const brandConfig =
    getCurrentBrandConfig() || getBrandConfigByName(getFromName(options.from));

  if (!brandConfig) return;

  const adminRecipients = [
    process.env.EMAIL_RECEIVER,
    process.env.OPTIMAL_EMAIL_RECEIVER,
    process.env.DIGITAL_PARADIGM_EMAIL_RECEIVER,
  ].filter(Boolean);
  const isAdminEmail = adminRecipients.includes(options.to);

  options.from = `"${brandConfig.name}" <${process.env.EMAIL_USER}>`;

  if (isAdminEmail) {
    options.to = brandConfig.receiver;

    if (!options.subject.includes(brandConfig.name)) {
      options.subject = `${options.subject} - ${brandConfig.name}`;
    }

    if (!options.html.includes("<strong>Brand:</strong>")) {
      options.html = `<p><strong>Brand:</strong> ${brandConfig.name}</p>${options.html}`;
    }
    return;
  }

  if (brandConfig.key === "digital-paradigm") {
    options.html = options.html
      .replaceAll("Optimal IT Solutions", brandConfig.name)
      .replaceAll("https://optimal-itsolutions.com", brandConfig.website)
      .replaceAll("www.optimal-itsolutions.com", brandConfig.website)
      .replaceAll("+1 888-710-6350", brandConfig.phone)
      .replaceAll("8887106350", brandConfig.phone.replace(/\D/g, ""));
  }
}

async function sendEmailGraph(options) {
  applyBrandToMail(options);

  const {
    from,
    to,
    subject,
    html,
    attachments = [],
  } = options;

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

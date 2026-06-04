const { Client } = require("@microsoft/microsoft-graph-client");
const { ClientSecretCredential } = require("@azure/identity");
require("isomorphic-fetch");
require("dotenv").config();

async function sendEmailGraph({ to, subject, html }) {
  // ✅ Validate recipient
  if (!to || !to.includes("@")) {
    throw new Error("❌ Invalid recipient email address provided");
  }

  // OAuth2 credential
  const credential = new ClientSecretCredential(
    process.env.TENANT_ID,
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET
  );

  // Get access token
  const token = await credential.getToken("https://graph.microsoft.com/.default");

  // Graph client
  const client = Client.init({
    authProvider: (done) => {
      done(null, token.token);
    },
  });

  // Email payload (no explicit "from")
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

  // Send email
  await client
    .api(`/users/${process.env.EMAIL_USER}/sendMail`)
    .post({ message, saveToSentItems: true });

  console.log(`✅ Email sent to ${to}`);
}

module.exports = sendEmailGraph;

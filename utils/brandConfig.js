require("dotenv").config();
const { AsyncLocalStorage } = require("node:async_hooks");

const brandContext = new AsyncLocalStorage();

const parseList = (value) =>
  (value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

const BRAND_CONFIG = {
  optimal: {
    key: "optimal",
    name: "Optimal IT Solutions",
    receiver:
      process.env.OPTIMAL_EMAIL_RECEIVER || process.env.EMAIL_RECEIVER,
    website: "https://optimal-itsolutions.com",
    phone: "+1 888-710-6350",
    domains: ["optimal-itsolutions.com", "www.optimal-itsolutions.com"],
  },
  "digital-paradigm": {
    key: "digital-paradigm",
    name: "Digital Paradigm",
    receiver: process.env.DIGITAL_PARADIGM_EMAIL_RECEIVER,
    website:
      process.env.DIGITAL_PARADIGM_WEBSITE ||
      "https://www.digitalparadigm.com.au",
    phone: process.env.DIGITAL_PARADIGM_PHONE || "+61 2 5119 4369",
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

function getBrandConfig(req) {
  const requestedBrand = req.body?.brand;
  const hostname = getRequestHostname(req);

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return BRAND_CONFIG[requestedBrand] || BRAND_CONFIG.optimal;
  }

  const matchedBrand = Object.values(BRAND_CONFIG).find((config) =>
    config.domains.includes(hostname)
  );

  return matchedBrand || BRAND_CONFIG[requestedBrand] || null;
}

function validateBrand(req, res) {
  const brandConfig = getBrandConfig(req);

  if (!brandConfig) {
    res
      .status(400)
      .json({ error: "Unable to detect brand from request domain" });
    return null;
  }

  if (!brandConfig.receiver) {
    console.error(
      `Missing email receiver configuration for brand: ${brandConfig.key}`
    );
    res.status(500).json({ error: "Email receiver is not configured" });
    return null;
  }

  return brandConfig;
}

function brandRequestContext(req, res, next) {
  const brandConfig = validateBrand(req, res);

  if (!brandConfig) return;

  brandContext.run(brandConfig, next);
}

function getCurrentBrandConfig() {
  return brandContext.getStore() || null;
}

function getConfirmationHtml(brandConfig, name = "", service = "") {
  const greeting = name ? `Hi ${name}` : "Hi";
  const serviceText = service ? `${service} ` : "";

  return `
    <div style="font-family: Helvetica, Arial, sans-serif; font-size: 16px; color: #333;">
      <p>${greeting}</p>
      <p>Thanks for reaching out to <strong>${brandConfig.name}!</strong> We're excited to bring your ${serviceText}vision to life. One of our team members will connect with you within 24 hours to discuss your goals and next steps.</p>
      <p>In the meantime, you can visit us at <a href="${brandConfig.website}">${brandConfig.website}</a> or call us at ${brandConfig.phone} anytime.</p>
      <p>Best,</p>
      <p><strong>Team ${brandConfig.name}</strong></p>
    </div>
  `;
}

module.exports = {
  validateBrand,
  getConfirmationHtml,
  brandRequestContext,
  getCurrentBrandConfig,
};

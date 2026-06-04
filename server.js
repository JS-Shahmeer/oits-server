const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const cron = require("node-cron");

require("dotenv").config();

// Routes
const contactRoute = require("./routes/contact");
const consultationRoute = require("./routes/consultation");
const thirdformRoute = require("./routes/thirdform");
const socialChecklistRoute = require("./routes/socialChecklist");
const socialPresenceRoute = require("./routes/socialPresence");
const newsletterRoute = require("./routes/newsletter");
const ppcHeroFormRoute = require("./routes/ppcHeroForm");
const mobileppcHeroForm = require("./routes/mobileppcheroform");
const activityRoutes = require("./routes/activity");
const runReportEmails = require("./jobs/reportEmails");

const app = express();

// ✅ Global CORS
const allowedOrigins = [
  "https://www.optimal-itsolutions.com",
  "http://localhost:5173",
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static("uploads")); // serve uploaded files

// Routes
app.use("/api/contact", contactRoute);
app.use("/api/consultation", consultationRoute);
app.use("/api/thirdform", thirdformRoute);
app.use("/api/socialChecklist", socialChecklistRoute);
app.use("/api/socialPresence", socialPresenceRoute);
app.use("/api/newsletter", newsletterRoute);
app.use("/api/ppcHeroForm", ppcHeroFormRoute);
app.use("/api/activity", activityRoutes);
app.use("/api/mobileppcheroform", mobileppcHeroForm);

// Schedule cron job (every 12 hours at minute 0)
cron.schedule("0 */12 * * *", () => {
  console.log("⏳ Running 12-hour email report job...");
  runReportEmails();
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

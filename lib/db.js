// lib/db.js
const mysql = require("mysql2/promise");

// Create a pool (recommended for production apps)
const pool = mysql.createPool({
  host: process.env.DB_HOST,     // e.g. "localhost"
  user: process.env.DB_USER,     // e.g. "root"
  password: process.env.DB_PASS, // your DB password
  database: process.env.DB_NAME, // e.g. "optimalit"
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports = pool;

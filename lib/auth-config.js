const crypto = require("crypto");

function getAdminPassword() {
  if (process.env.NETLIFY !== "true") {
    require("dotenv").config({ override: true });
  }
  return String(process.env.ADMIN_PASSWORD || "supreme2026").trim();
}

function getSessionSecret() {
  if (process.env.NETLIFY !== "true") {
    require("dotenv").config({ override: true });
  }
  return String(
    process.env.SESSION_SECRET || "supreme-advertising-dev-session-secret"
  ).trim();
}

function verifyAdminPassword(password) {
  const expected = getAdminPassword();
  const input = String(password || "").trim();
  if (!input || input.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(input), Buffer.from(expected));
}

function isProductionHost() {
  return Boolean(
    process.env.NETLIFY === "true" ||
      process.env.CONTEXT === "production" ||
      process.env.NODE_ENV === "production"
  );
}

module.exports = {
  getAdminPassword,
  getSessionSecret,
  verifyAdminPassword,
  isProductionHost,
};

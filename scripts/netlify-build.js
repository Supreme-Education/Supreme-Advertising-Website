/**
 * Netlify build step for the public marketing site.
 * No Prisma, no DATABASE_URL, no native DB migrations — this project uses better-sqlite3 locally.
 */
console.log("Netlify build: static site + serverless /api functions.");
console.log(
  "Set ADMIN_PASSWORD and SESSION_SECRET in Netlify → Environment variables (same values as local .env)."
);
const fs = require("fs");
const path = require("path");
const seed = path.join(__dirname, "..", "lib", "admin-seed.json");
if (fs.existsSync(seed)) {
  const data = JSON.parse(fs.readFileSync(seed, "utf8"));
  console.log(`Admin seed bundled: ${data.customers?.length || 0} customers.`);
} else {
  console.log("Warning: data/admin-seed.json missing — run npm run export-seed before deploy.");
}

/**
 * Netlify build step for the public marketing site.
 * No Prisma, no DATABASE_URL, no native DB migrations — this project uses better-sqlite3 locally.
 */
console.log("Netlify build: static site + serverless /api functions.");
console.log(
  "Set ADMIN_PASSWORD and SESSION_SECRET in Netlify → Environment variables (same values as local .env)."
);

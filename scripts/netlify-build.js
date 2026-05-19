/**
 * Netlify build step for the public marketing site.
 * No Prisma, no DATABASE_URL, no native DB migrations — this project uses better-sqlite3 locally.
 */
console.log("Netlify build: preparing static site (HTML, CSS, JS, assets, gallery JSON).");
console.log("Admin invoicing API requires running: node server.js (not available on static Netlify hosting).");

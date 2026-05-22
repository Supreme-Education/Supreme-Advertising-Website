/**
 * Export local SQLite customers (and documents) for Netlify seed deploy.
 *   node scripts/export-admin-seed.js
 */
require("dotenv").config({ override: true });
const fs = require("fs");
const path = require("path");
const db = require("../lib/db");

const customers = db.listCustomers();
const documents = db.listDocuments();
const maxCustomer = customers.reduce((m, c) => Math.max(m, c.id), 0);
const maxDocument = documents.reduce((m, d) => Math.max(m, d.id), 0);

const state = {
  documents,
  customers,
  nextId: {
    document: maxDocument + 1,
    customer: maxCustomer + 1,
  },
};

const out = path.join(__dirname, "..", "data", "admin-seed.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(state), "utf8");
console.log(`Wrote ${out}`);
console.log(`  ${customers.length} customers, ${documents.length} documents`);

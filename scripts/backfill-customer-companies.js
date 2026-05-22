/**
 * Set company from email for all customers (local SQLite).
 *   node scripts/backfill-customer-companies.js
 */
require("dotenv").config({ override: true });
const db = require("../lib/db");
const { companyFromEmail, domainOverridesForEmail } = require("../lib/company-from-email");
const { normalizeCustomerPayload } = require("../lib/document-normalize");

const customers = db.listCustomers();
let updated = 0;
let empty = 0;

for (const c of customers) {
  const email = String(c.email || "").trim();
  if (!email) continue;
  const normalized = normalizeCustomerPayload(c);
  const company = normalized.company;
  if (!company) {
    empty++;
    continue;
  }
  if (
    c.company === normalized.company &&
    c.address === normalized.address
  ) {
    continue;
  }
  db.updateCustomer(c.id, normalized);
  updated++;
}

console.log(`Customers: ${customers.length}`);
console.log(`Updated with company: ${updated}`);
console.log(`No business domain (Gmail, etc.): ${empty}`);

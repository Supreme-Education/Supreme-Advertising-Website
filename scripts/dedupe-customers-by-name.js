/**
 * Remove duplicate customers that share the same name (case-insensitive).
 * Keeps the best row per name: prefers email, then company, then lowest id.
 *
 *   node scripts/dedupe-customers-by-name.js
 *   node scripts/dedupe-customers-by-name.js --dry-run
 */
require("dotenv").config({ override: true });
const db = require("../lib/db");

const dryRun = process.argv.includes("--dry-run");

function nameKey(name) {
  return String(name || "").trim().toLowerCase();
}

function scoreCustomer(c) {
  let score = 0;
  if (String(c.email || "").trim()) score += 100;
  if (String(c.company || "").trim()) score += 10;
  if (String(c.phone || "").trim()) score += 5;
  if (String(c.address || "").trim()) score += 3;
  return score;
}

function pickKeeper(rows) {
  return rows
    .slice()
    .sort((a, b) => scoreCustomer(b) - scoreCustomer(a) || a.id - b.id)[0];
}

const all = db.listCustomers();
const groups = new Map();

for (const c of all) {
  const key = nameKey(c.name);
  if (!key) continue;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(c);
}

const duplicateGroups = [...groups.entries()].filter(([, rows]) => rows.length > 1);
let deleted = 0;

for (const [key, rows] of duplicateGroups) {
  const keeper = pickKeeper(rows);
  const remove = rows.filter((r) => r.id !== keeper.id);
  console.log(`"${key}" — keep #${keeper.id} (${keeper.email || "no email"}), remove ${remove.length}`);
  for (const row of remove) {
    if (dryRun) {
      console.log(`  would delete #${row.id} ${row.email || ""}`);
    } else {
      db.deleteCustomer(row.id);
      deleted++;
    }
  }
}

console.log("");
console.log(`Duplicate name groups: ${duplicateGroups.length}`);
console.log(dryRun ? `Would delete: ${duplicateGroups.reduce((s, [, r]) => s + r.length - 1, 0)}` : `Deleted: ${deleted}`);
console.log(`Customers remaining: ${db.listCustomers().length}`);

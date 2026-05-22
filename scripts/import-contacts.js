/**
 * Import Yahoo (or any) contacts into the admin customers table.
 *
 * Recommended: export from Yahoo Contacts as CSV, then:
 *   node scripts/import-contacts.js path/to/contacts.csv
 *
 * Optional CardDAV (requires Yahoo App Password, not your login password):
 *   Set YAHOO_EMAIL and YAHOO_APP_PASSWORD in .env, then:
 *   node scripts/import-contacts.js --yahoo
 */
require("dotenv").config({ override: true });
const fs = require("fs");
const path = require("path");
const https = require("https");
const db = require("../lib/db");

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function existingKeys() {
  const customers = db.listCustomers();
  const byEmail = new Set();
  const byName = new Set();
  for (const c of customers) {
    const email = normalizeEmail(c.email);
    if (email) byEmail.add(email);
    byName.add(String(c.name || "").trim().toLowerCase());
  }
  return { byEmail, byName };
}

function shouldSkip(entry, keys) {
  const email = normalizeEmail(entry.email);
  const name = String(entry.name || "").trim().toLowerCase();
  if (!name) return "missing name";
  if (email && keys.byEmail.has(email)) return "duplicate email";
  if (!email && keys.byName.has(name)) return "duplicate name";
  return null;
}

function recordImport(entry, keys) {
  const created = db.createCustomer(entry);
  const email = normalizeEmail(created.email);
  if (email) keys.byEmail.add(email);
  keys.byName.add(String(created.name || "").trim().toLowerCase());
  return created;
}

/** Minimal CSV parser (handles quoted fields). */
function parseCsv(text) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (!lines.length) return [];

  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cells = splitCsvLine(line);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = (cells[idx] || "").trim();
    });
    rows.push(row);
  }
  return rows;
}

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function pick(row, names) {
  const keys = Object.keys(row);
  for (const want of names) {
    const key = keys.find((k) => k.toLowerCase() === want.toLowerCase());
    if (key && row[key]) return row[key];
  }
  return "";
}

function rowToCustomer(row) {
  const first = pick(row, ["First Name", "First", "Given Name", "givenName"]);
  const last = pick(row, ["Last Name", "Last", "Family Name", "familyName", "Surname"]);
  const name =
    pick(row, ["Name", "Full Name", "File As", "Nickname", "Company"]) ||
    [first, last].filter(Boolean).join(" ").trim();
  const email = pick(row, ["Email", "E-mail", "Email Address", "E-mail Address", "email"]);
  const { companyFromEmail } = require("../lib/company-from-email");
  const companyFromRow = pick(row, ["Company", "Organization", "Org"]);
  return {
    name,
    company: companyFromRow || (email ? companyFromEmail(email) : ""),
    email,
    phone: pick(row, [
      "Phone",
      "Mobile",
      "Phone Number",
      "Mobile Phone",
      "Primary Phone",
      "Cell",
      "Tel",
    ]),
    address: pick(row, ["Address", "Street", "Home Street", "Business Address", "Location"]),
  };
}

function importFromCsv(filePath) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    console.error(`File not found: ${abs}`);
    process.exit(1);
  }
  const rows = parseCsv(fs.readFileSync(abs, "utf8"));
  return importEntries(rows.map(rowToCustomer));
}

function importEntries(entries) {
  const keys = existingKeys();
  let added = 0;
  let skipped = 0;
  const reasons = {};

  for (const entry of entries) {
    const reason = shouldSkip(entry, keys);
    if (reason) {
      skipped++;
      reasons[reason] = (reasons[reason] || 0) + 1;
      continue;
    }
    recordImport(entry, keys);
    added++;
  }

  return { added, skipped, reasons, total: entries.length };
}

function parseVcard(vcard) {
  const lines = vcard.split(/\r?\n/);
  let name = "";
  let email = "";
  let phone = "";
  let address = "";
  for (const line of lines) {
    if (line.startsWith("FN:")) name = line.slice(3).trim();
    else if (line.startsWith("N:") && !name) {
      const parts = line.slice(2).split(";");
      name = [parts[1], parts[0]].filter(Boolean).join(" ").trim();
    } else if (line.toUpperCase().startsWith("EMAIL")) {
      email = line.split(":").slice(1).join(":").trim();
    } else if (line.toUpperCase().startsWith("TEL")) {
      phone = phone || line.split(":").slice(1).join(":").trim();
    } else if (line.toUpperCase().startsWith("ADR")) {
      const parts = line.split(":").slice(1).join(":").split(";");
      address = parts.filter(Boolean).join(", ").trim();
    }
  }
  return { name, email, phone, address };
}

function fetchYahooCardDav() {
  const email = process.env.YAHOO_EMAIL || process.env.YAHOO_USER;
  const password = process.env.YAHOO_APP_PASSWORD;
  if (!email || !password) {
    console.error(
      "Set YAHOO_EMAIL and YAHOO_APP_PASSWORD in .env (Yahoo App Password, not your login password)."
    );
    console.error("Create one at: https://login.yahoo.com/account/security");
    process.exit(1);
  }

  const auth = Buffer.from(`${email}:${password}`).toString("base64");
  const body = `<?xml version="1.0" encoding="utf-8" ?>
<C:addressbook-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:carddav">
  <D:prop>
    <D:getetag />
    <C:address-data />
  </D:prop>
</C:addressbook-query>`;

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "carddav.address.yahoo.com",
        path: "/dav/users/" + encodeURIComponent(email) + "/contacts",
        method: "REPORT",
        headers: {
          Authorization: `Basic ${auth}`,
          Depth: "1",
          "Content-Type": "application/xml; charset=utf-8",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode >= 400) {
            reject(
              new Error(
                `Yahoo CardDAV failed (${res.statusCode}). Use a Yahoo App Password or import via CSV export instead.`
              )
            );
            return;
          }
          const vcards = [];
          const re = /BEGIN:VCARD[\s\S]*?END:VCARD/g;
          let m;
          while ((m = re.exec(data))) vcards.push(m[0]);
          resolve(vcards.map(parseVcard).filter((c) => c.name));
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function importFromYahoo() {
  const entries = await fetchYahooCardDav();
  console.log(`Fetched ${entries.length} contact(s) from Yahoo CardDAV.`);
  return importEntries(entries);
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.log(`
Import contacts into admin customers (SQLite).

  node scripts/import-contacts.js contacts.csv
  node scripts/import-contacts.js --yahoo

Export from Yahoo:
  1. Open https://contacts.yahoo.com/
  2. Select contacts → Actions → Export
  3. Save CSV, then run this script on that file
`);
    process.exit(0);
  }

  const result =
    arg === "--yahoo" || arg === "--carddav"
      ? await importFromYahoo()
      : importFromCsv(arg);

  console.log(`Processed: ${result.total}`);
  console.log(`Added: ${result.added}`);
  console.log(`Skipped: ${result.skipped}`);
  if (Object.keys(result.reasons).length) {
    console.log("Skip reasons:", result.reasons);
  }
  console.log(`Customers in database: ${db.listCustomers().length}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

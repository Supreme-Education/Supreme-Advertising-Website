const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const dataDir = path.join(__dirname, "..", "data");

function isServerlessRuntime() {
  return Boolean(
    process.env.NETLIFY === "true" ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.NETLIFY_DEV
  );
}

function ensureLocalDataDir() {
  if (isServerlessRuntime()) return;
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function getDatabasePath() {
  if (isServerlessRuntime()) {
    const tmpDir = path.join("/tmp", "supreme-advertising");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    return path.join(tmpDir, "admin.db");
  }
  ensureLocalDataDir();
  return path.join(dataDir, "admin.db");
}

ensureLocalDataDir();
const db = new Database(getDatabasePath());

db.exec(`
  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK (type IN ('invoice', 'quotation')),
    doc_number TEXT NOT NULL UNIQUE,
    issue_date TEXT NOT NULL,
    due_date TEXT,
    client_name TEXT NOT NULL,
    client_address TEXT,
    client_phone TEXT,
    client_email TEXT,
    line_items TEXT NOT NULL DEFAULT '[]',
    subtotal REAL NOT NULL DEFAULT 0,
    tax_rate REAL NOT NULL DEFAULT 0,
    tax_amount REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);
  CREATE INDEX IF NOT EXISTS idx_documents_issue_date ON documents(issue_date);

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    email TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
`);

function ensureDocumentColumn(name, ddl) {
  const columns = db.prepare("PRAGMA table_info(documents)").all();
  if (!columns.some((col) => col.name === name)) db.exec(ddl);
}
ensureDocumentColumn(
  "discount_amount",
  "ALTER TABLE documents ADD COLUMN discount_amount REAL NOT NULL DEFAULT 0"
);
ensureDocumentColumn(
  "advance_amount",
  "ALTER TABLE documents ADD COLUMN advance_amount REAL NOT NULL DEFAULT 0"
);
ensureDocumentColumn("general_line", "ALTER TABLE documents ADD COLUMN general_line TEXT");

function parseDocument(row) {
  if (!row) return null;
  return {
    ...row,
    line_items: JSON.parse(row.line_items || "[]"),
  };
}

function nextDocNumber(type) {
  const prefix = type === "invoice" ? "INV" : "QUO";
  const year = new Date().getFullYear();
  const pattern = `${prefix}-${year}-%`;
  const row = db
    .prepare(
      `SELECT doc_number FROM documents
       WHERE type = ? AND doc_number LIKE ?
       ORDER BY id DESC LIMIT 1`
    )
    .get(type, pattern);

  let seq = 1;
  if (row) {
    const parts = row.doc_number.split("-");
    const last = parseInt(parts[parts.length - 1], 10);
    if (!Number.isNaN(last)) seq = last + 1;
  }
  return `${prefix}-${year}-${String(seq).padStart(3, "0")}`;
}

function listDocuments({ type, search } = {}) {
  let sql = "SELECT * FROM documents WHERE 1=1";
  const params = [];
  if (type) {
    sql += " AND type = ?";
    params.push(type);
  }
  if (search) {
    sql += " AND (doc_number LIKE ? OR client_name LIKE ?)";
    const q = `%${search}%`;
    params.push(q, q);
  }
  sql += " ORDER BY datetime(issue_date) DESC, id DESC";
  return db.prepare(sql).all(...params).map(parseDocument);
}

function getDocument(id) {
  return parseDocument(db.prepare("SELECT * FROM documents WHERE id = ?").get(id));
}

function createDocument(data) {
  const docNumber = data.doc_number || nextDocNumber(data.type);
  const stmt = db.prepare(`
    INSERT INTO documents (
      type, doc_number, issue_date, due_date,
      client_name, client_address, client_phone, client_email,
      line_items, subtotal, discount_amount, advance_amount, tax_rate, tax_amount, total, notes, general_line, status
    ) VALUES (
      @type, @doc_number, @issue_date, @due_date,
      @client_name, @client_address, @client_phone, @client_email,
      @line_items, @subtotal, @discount_amount, @advance_amount, @tax_rate, @tax_amount, @total, @notes, @general_line, @status
    )
  `);
  const payload = normalizePayload(data, docNumber);
  const result = stmt.run(payload);
  return getDocument(result.lastInsertRowid);
}

function updateDocument(id, data) {
  const existing = getDocument(id);
  if (!existing) return null;
  const stmt = db.prepare(`
    UPDATE documents SET
      issue_date = @issue_date,
      due_date = @due_date,
      client_name = @client_name,
      client_address = @client_address,
      client_phone = @client_phone,
      client_email = @client_email,
      line_items = @line_items,
      subtotal = @subtotal,
      discount_amount = @discount_amount,
      advance_amount = @advance_amount,
      tax_rate = @tax_rate,
      tax_amount = @tax_amount,
      total = @total,
      notes = @notes,
      general_line = @general_line,
      status = @status,
      updated_at = datetime('now')
    WHERE id = @id
  `);
  const payload = normalizePayload({ ...existing, ...data }, existing.doc_number);
  payload.id = id;
  stmt.run(payload);
  return getDocument(id);
}

function deleteDocument(id) {
  const result = db.prepare("DELETE FROM documents WHERE id = ?").run(id);
  return result.changes > 0;
}

function normalizePayload(data, docNumber) {
  const lineItems = Array.isArray(data.line_items) ? data.line_items : [];
  const subtotal = roundMoney(
    lineItems.reduce((sum, row) => sum + Number(row.qty || 0) * Number(row.unit_price || 0), 0)
  );
  const discountAmount = roundMoney(Math.max(0, Number(data.discount_amount || 0)));
  const advanceAmount = roundMoney(Math.max(0, Number(data.advance_amount || 0)));
  const taxable = roundMoney(Math.max(0, subtotal - discountAmount));
  const taxRate = Number(data.tax_rate || 0);
  const taxAmount = roundMoney(taxable * (taxRate / 100));
  const total = roundMoney(Math.max(0, taxable + taxAmount - advanceAmount));

  return {
    type: data.type,
    doc_number: docNumber,
    issue_date: data.issue_date,
    due_date: data.due_date || null,
    client_name: data.client_name || "",
    client_address: data.client_address || "",
    client_phone: data.client_phone || "",
    client_email: data.client_email || "",
    line_items: JSON.stringify(
      lineItems.map((row) => ({
        description: row.description || "",
        qty: Number(row.qty) || 0,
        unit_price: Number(row.unit_price) || 0,
        amount: roundMoney((Number(row.qty) || 0) * (Number(row.unit_price) || 0)),
      }))
    ),
    subtotal,
    discount_amount: discountAmount,
    advance_amount: advanceAmount,
    tax_rate: taxRate,
    tax_amount: taxAmount,
    total,
    notes: data.notes || "",
    general_line: data.type === "quotation" ? String(data.general_line || "").trim() : "",
    status: data.status || "draft",
  };
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function listCustomers({ search } = {}) {
  let sql = "SELECT * FROM customers WHERE 1=1";
  const params = [];
  if (search) {
    sql += " AND (name LIKE ? OR email LIKE ? OR address LIKE ?)";
    const q = `%${search}%`;
    params.push(q, q, q);
  }
  sql += " ORDER BY name COLLATE NOCASE ASC, id ASC";
  return db.prepare(sql).all(...params);
}

function getCustomer(id) {
  return db.prepare("SELECT * FROM customers WHERE id = ?").get(id) || null;
}

function createCustomer(data) {
  const stmt = db.prepare(`
    INSERT INTO customers (name, address, phone, email)
    VALUES (@name, @address, @phone, @email)
  `);
  const payload = normalizeCustomerPayload(data);
  const result = stmt.run(payload);
  return getCustomer(result.lastInsertRowid);
}

function updateCustomer(id, data) {
  const existing = getCustomer(id);
  if (!existing) return null;
  const stmt = db.prepare(`
    UPDATE customers SET
      name = @name,
      address = @address,
      phone = @phone,
      email = @email,
      updated_at = datetime('now')
    WHERE id = @id
  `);
  const payload = normalizeCustomerPayload({ ...existing, ...data });
  payload.id = id;
  stmt.run(payload);
  return getCustomer(id);
}

function deleteCustomer(id) {
  const result = db.prepare("DELETE FROM customers WHERE id = ?").run(id);
  return result.changes > 0;
}

function normalizeCustomerPayload(data) {
  return {
    name: String(data.name || "").trim(),
    address: String(data.address || "").trim(),
    phone: String(data.phone || "").trim(),
    email: String(data.email || "").trim(),
  };
}

function getStats() {
  const invoices = db
    .prepare("SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS total FROM documents WHERE type = 'invoice'")
    .get();
  const quotations = db
    .prepare("SELECT COUNT(*) AS count FROM documents WHERE type = 'quotation'")
    .get();
  return { invoices, quotations };
}

module.exports = {
  db,
  nextDocNumber,
  listDocuments,
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getStats,
};

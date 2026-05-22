/**
 * JSON file store for Netlify Functions (no native SQLite — keeps bundles under 50MB).
 * Data lives in /tmp and resets when the function cold-starts.
 */
const fs = require("fs");
const path = require("path");
const {
  parseDocument,
  normalizePayload,
  normalizeCustomerPayload,
} = require("./document-normalize");

const dataDir = path.join("/tmp", "supreme-advertising");
const dataFile = path.join(dataDir, "admin-data.json");

function nowIso() {
  return new Date().toISOString();
}

function defaultState() {
  return { documents: [], customers: [], nextId: { document: 1, customer: 1 } };
}

function ensureDir() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
}

function readState() {
  ensureDir();
  if (!fs.existsSync(dataFile)) return defaultState();
  try {
    return JSON.parse(fs.readFileSync(dataFile, "utf8"));
  } catch {
    return defaultState();
  }
}

function writeState(state) {
  ensureDir();
  fs.writeFileSync(dataFile, JSON.stringify(state, null, 2), "utf8");
}

function nextDocNumber(type) {
  const state = readState();
  const prefix = type === "invoice" ? "INV" : "QUO";
  const year = new Date().getFullYear();
  const pattern = `${prefix}-${year}-`;
  const matches = state.documents
    .filter((d) => d.type === type && d.doc_number.startsWith(pattern))
    .map((d) => d.doc_number);
  let seq = 1;
  if (matches.length) {
    const last = matches.sort().pop();
    const parts = last.split("-");
    const n = parseInt(parts[parts.length - 1], 10);
    if (!Number.isNaN(n)) seq = n + 1;
  }
  return `${prefix}-${year}-${String(seq).padStart(3, "0")}`;
}

function listDocuments({ type, search } = {}) {
  let docs = readState().documents.map(parseDocument);
  if (type) docs = docs.filter((d) => d.type === type);
  if (search) {
    const q = String(search).toLowerCase();
    docs = docs.filter(
      (d) =>
        d.doc_number.toLowerCase().includes(q) || d.client_name.toLowerCase().includes(q)
    );
  }
  return docs.sort((a, b) => {
    const da = new Date(a.issue_date).getTime();
    const db = new Date(b.issue_date).getTime();
    return db - da || b.id - a.id;
  });
}

function getDocument(id) {
  const doc = readState().documents.find((d) => d.id === id);
  return parseDocument(doc);
}

function createDocument(data) {
  const state = readState();
  const docNumber = data.doc_number || nextDocNumber(data.type);
  const normalized = normalizePayload(data, docNumber);
  const id = state.nextId.document++;
  const ts = nowIso();
  const row = {
    id,
    ...normalized,
    created_at: ts,
    updated_at: ts,
  };
  state.documents.push(row);
  writeState(state);
  return parseDocument(row);
}

function updateDocument(id, data) {
  const state = readState();
  const idx = state.documents.findIndex((d) => d.id === id);
  if (idx === -1) return null;
  const existing = parseDocument(state.documents[idx]);
  const normalized = normalizePayload({ ...existing, ...data }, existing.doc_number);
  const row = {
    ...existing,
    ...normalized,
    id,
    updated_at: nowIso(),
  };
  state.documents[idx] = row;
  writeState(state);
  return parseDocument(row);
}

function deleteDocument(id) {
  const state = readState();
  const before = state.documents.length;
  state.documents = state.documents.filter((d) => d.id !== id);
  if (state.documents.length === before) return false;
  writeState(state);
  return true;
}

function listCustomers({ search } = {}) {
  let customers = readState().customers;
  if (search) {
    const q = String(search).toLowerCase();
    customers = customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        (c.company || "").toLowerCase().includes(q) ||
        (c.address || "").toLowerCase().includes(q)
    );
  }
  return customers.sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);
}

function getCustomer(id) {
  return readState().customers.find((c) => c.id === id) || null;
}

function createCustomer(data) {
  const state = readState();
  const payload = normalizeCustomerPayload(data);
  const id = state.nextId.customer++;
  const ts = nowIso();
  const row = { id, ...payload, created_at: ts, updated_at: ts };
  state.customers.push(row);
  writeState(state);
  return row;
}

function updateCustomer(id, data) {
  const state = readState();
  const idx = state.customers.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  const existing = state.customers[idx];
  const payload = normalizeCustomerPayload({ ...existing, ...data });
  const row = { ...existing, ...payload, id, updated_at: nowIso() };
  state.customers[idx] = row;
  writeState(state);
  return row;
}

function deleteCustomer(id) {
  const state = readState();
  const before = state.customers.length;
  state.customers = state.customers.filter((c) => c.id !== id);
  if (state.customers.length === before) return false;
  writeState(state);
  return true;
}

function getStats() {
  const docs = readState().documents;
  const invoices = docs.filter((d) => d.type === "invoice");
  return {
    invoices: {
      count: invoices.length,
      total: invoices.reduce((sum, d) => sum + Number(d.total || 0), 0),
    },
    quotations: { count: docs.filter((d) => d.type === "quotation").length },
  };
}

module.exports = {
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

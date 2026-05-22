/**
 * JSON admin store for Netlify Functions.
 * Persists via Netlify Blobs; falls back to bundled data/admin-seed.json on first deploy.
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
const seedPath = path.join(__dirname, "..", "data", "admin-seed.json");
const BLOB_KEY = "admin-state";

let stateCache = null;
let initPromise = null;

function isServerless() {
  return Boolean(
    process.env.NETLIFY === "true" || process.env.AWS_LAMBDA_FUNCTION_NAME
  );
}

function nowIso() {
  return new Date().toISOString();
}

function defaultState() {
  return { documents: [], customers: [], nextId: { document: 1, customer: 1 } };
}

function ensureDir() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
}

function loadSeedFile() {
  try {
    if (fs.existsSync(seedPath)) {
      const state = JSON.parse(fs.readFileSync(seedPath, "utf8"));
      if (Array.isArray(state.customers)) return state;
    }
  } catch (err) {
    console.error("Failed to load admin seed:", err);
  }
  return defaultState();
}

async function getBlobStore() {
  if (!isServerless()) return null;
  try {
    const { getStore } = require("@netlify/blobs");
    return getStore({ name: "supreme-admin-data", consistency: "strong" });
  } catch (err) {
    console.warn("Netlify Blobs unavailable:", err.message);
    return null;
  }
}

async function persistState(state) {
  stateCache = state;
  const store = await getBlobStore();
  if (store) {
    await store.setJSON(BLOB_KEY, state);
    return;
  }
  ensureDir();
  fs.writeFileSync(dataFile, JSON.stringify(state), "utf8");
}

/** Call once per function invocation before handling API routes. */
async function initStore() {
  if (stateCache) return stateCache;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const store = await getBlobStore();

    if (store) {
      const blob = await store.get(BLOB_KEY, { type: "json" });
      if (blob && Array.isArray(blob.customers) && blob.customers.length > 0) {
        stateCache = blob;
        return stateCache;
      }
    }

    ensureDir();
    if (fs.existsSync(dataFile)) {
      try {
        const local = JSON.parse(fs.readFileSync(dataFile, "utf8"));
        if (Array.isArray(local.customers)) {
          stateCache = local;
          if (store) await store.setJSON(BLOB_KEY, stateCache);
          return stateCache;
        }
      } catch {
        /* use seed */
      }
    }

    stateCache = loadSeedFile();
    await persistState(stateCache);
    console.log(
      `Admin store initialized from seed: ${stateCache.customers.length} customers`
    );
    return stateCache;
  })();

  return initPromise;
}

function readState() {
  if (!stateCache) {
    throw new Error("Store not initialized — call initStore() first");
  }
  return stateCache;
}

function writeState(state) {
  stateCache = state;
  persistState(state).catch((err) => console.error("persistState failed:", err));
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
        d.doc_number.toLowerCase().includes(q) ||
        d.client_name.toLowerCase().includes(q)
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
  initStore,
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

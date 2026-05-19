require("dotenv").config();
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const {
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
  nextDocNumber,
} = require("./lib/db");
const { loadCompany } = require("./lib/company");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "supreme2026";
const SESSION_SECRET =
  process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");

const passwordHash = bcrypt.hashSync(ADMIN_PASSWORD, 10);

app.use(express.json({ limit: "1mb" }));
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 12,
    },
  })
);

function requireAuth(req, res, next) {
  if (req.session?.authenticated) return next();
  res.status(401).json({ error: "Unauthorized" });
}

app.post("/api/login", (req, res) => {
  const { password } = req.body || {};
  if (!password || !bcrypt.compareSync(password, passwordHash)) {
    return res.status(401).json({ error: "Invalid password" });
  }
  req.session.authenticated = true;
  res.json({ ok: true });
});

app.post("/api/logout", requireAuth, (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.get("/api/session", (req, res) => {
  res.json({ authenticated: Boolean(req.session?.authenticated) });
});

app.get("/api/company", requireAuth, (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json(loadCompany());
});

app.get("/api/stats", requireAuth, (_req, res) => {
  res.json(getStats());
});

app.get("/api/next-number", requireAuth, (req, res) => {
  const type = req.query.type === "quotation" ? "quotation" : "invoice";
  res.json({ doc_number: nextDocNumber(type) });
});

app.get("/api/documents", requireAuth, (req, res) => {
  const docs = listDocuments({
    type: req.query.type || undefined,
    search: req.query.search || undefined,
  });
  res.json(docs);
});

app.get("/api/documents/:id", requireAuth, (req, res) => {
  const doc = getDocument(Number(req.params.id));
  if (!doc) return res.status(404).json({ error: "Not found" });
  res.json(doc);
});

app.post("/api/documents", requireAuth, (req, res) => {
  try {
    const doc = createDocument(req.body);
    res.status(201).json(doc);
  } catch (err) {
    res.status(400).json({ error: err.message || "Could not create document" });
  }
});

app.put("/api/documents/:id", requireAuth, (req, res) => {
  const doc = updateDocument(Number(req.params.id), req.body);
  if (!doc) return res.status(404).json({ error: "Not found" });
  res.json(doc);
});

app.delete("/api/documents/:id", requireAuth, (req, res) => {
  const ok = deleteDocument(Number(req.params.id));
  if (!ok) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true });
});

app.get("/api/customers", requireAuth, (req, res) => {
  res.json(listCustomers({ search: req.query.search || undefined }));
});

app.get("/api/customers/:id", requireAuth, (req, res) => {
  const customer = getCustomer(Number(req.params.id));
  if (!customer) return res.status(404).json({ error: "Not found" });
  res.json(customer);
});

app.post("/api/customers", requireAuth, (req, res) => {
  const name = String(req.body?.name || "").trim();
  if (!name) return res.status(400).json({ error: "Customer name is required" });
  try {
    const customer = createCustomer(req.body);
    res.status(201).json(customer);
  } catch (err) {
    res.status(400).json({ error: err.message || "Could not create customer" });
  }
});

app.put("/api/customers/:id", requireAuth, (req, res) => {
  const name = String(req.body?.name || "").trim();
  if (!name) return res.status(400).json({ error: "Customer name is required" });
  const customer = updateCustomer(Number(req.params.id), req.body);
  if (!customer) return res.status(404).json({ error: "Not found" });
  res.json(customer);
});

app.delete("/api/customers/:id", requireAuth, (req, res) => {
  const ok = deleteCustomer(Number(req.params.id));
  if (!ok) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true });
});

app.use(express.static(path.join(__dirname)));

app.get("/admin", (_req, res) => {
  res.sendFile(path.join(__dirname, "admin", "index.html"));
});

app.get("/admin/print/:id", (_req, res) => {
  res.sendFile(path.join(__dirname, "admin", "print.html"));
});

app.listen(PORT, () => {
  console.log(`Supreme Advertising site running at http://localhost:${PORT}`);
  console.log(`Admin portal: http://localhost:${PORT}/admin`);
  if (ADMIN_PASSWORD === "supreme2026") {
    console.log("Warning: Using default admin password. Set ADMIN_PASSWORD in .env");
  }
});

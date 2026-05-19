require("dotenv").config();
const path = require("path");
const express = require("express");
const { loadCompany } = require("./company");
const { verifyAdminPassword } = require("./auth-config");
const { sessionMiddleware, writeSession, clearSession } = require("./session-cookie");

function loadDb() {
  return require("./db");
}

/** API routes for invoices/customers (no login/logout/session). */
function createDataApp({ serverless = false } = {}) {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "1mb" }));
  app.use(sessionMiddleware);

  function requireAuth(req, res, next) {
    if (req.session?.authenticated) return next();
    res.status(401).json({ error: "Unauthorized" });
  }

  app.post("/api/login", (req, res) => {
    const { password } = req.body || {};
    if (!verifyAdminPassword(password)) {
      return res.status(401).json({ error: "Invalid password" });
    }
    writeSession(res, { authenticated: true });
    req.session = { authenticated: true };
    res.json({ ok: true });
  });

  app.post("/api/logout", (req, res) => {
    if (!req.session?.authenticated) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    clearSession(res);
    req.session = null;
    res.json({ ok: true });
  });

  app.get("/api/session", (req, res) => {
    res.json({ authenticated: Boolean(req.session?.authenticated) });
  });

  app.get("/api/company", requireAuth, (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json(loadCompany());
  });

  app.get("/api/stats", requireAuth, (_req, res) => {
    try {
      res.json(loadDb().getStats());
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Database unavailable" });
    }
  });

  app.get("/api/next-number", requireAuth, (req, res) => {
    try {
      const type = req.query.type === "quotation" ? "quotation" : "invoice";
      res.json({ doc_number: loadDb().nextDocNumber(type) });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Database unavailable" });
    }
  });

  app.get("/api/documents", requireAuth, (req, res) => {
    try {
      const docs = loadDb().listDocuments({
        type: req.query.type || undefined,
        search: req.query.search || undefined,
      });
      res.json(docs);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Database unavailable" });
    }
  });

  app.get("/api/documents/:id", requireAuth, (req, res) => {
    try {
      const doc = loadDb().getDocument(Number(req.params.id));
      if (!doc) return res.status(404).json({ error: "Not found" });
      res.json(doc);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Database unavailable" });
    }
  });

  app.post("/api/documents", requireAuth, (req, res) => {
    try {
      const doc = loadDb().createDocument(req.body);
      res.status(201).json(doc);
    } catch (err) {
      res.status(400).json({ error: err.message || "Could not create document" });
    }
  });

  app.put("/api/documents/:id", requireAuth, (req, res) => {
    try {
      const doc = loadDb().updateDocument(Number(req.params.id), req.body);
      if (!doc) return res.status(404).json({ error: "Not found" });
      res.json(doc);
    } catch (err) {
      res.status(400).json({ error: err.message || "Could not update document" });
    }
  });

  app.delete("/api/documents/:id", requireAuth, (req, res) => {
    try {
      const ok = loadDb().deleteDocument(Number(req.params.id));
      if (!ok) return res.status(404).json({ error: "Not found" });
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Database unavailable" });
    }
  });

  app.get("/api/customers", requireAuth, (req, res) => {
    try {
      res.json(loadDb().listCustomers({ search: req.query.search || undefined }));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Database unavailable" });
    }
  });

  app.get("/api/customers/:id", requireAuth, (req, res) => {
    try {
      const customer = loadDb().getCustomer(Number(req.params.id));
      if (!customer) return res.status(404).json({ error: "Not found" });
      res.json(customer);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Database unavailable" });
    }
  });

  app.post("/api/customers", requireAuth, (req, res) => {
    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json({ error: "Customer name is required" });
    try {
      const customer = loadDb().createCustomer(req.body);
      res.status(201).json(customer);
    } catch (err) {
      res.status(400).json({ error: err.message || "Could not create customer" });
    }
  });

  app.put("/api/customers/:id", requireAuth, (req, res) => {
    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json({ error: "Customer name is required" });
    try {
      const customer = loadDb().updateCustomer(Number(req.params.id), req.body);
      if (!customer) return res.status(404).json({ error: "Not found" });
      res.json(customer);
    } catch (err) {
      res.status(400).json({ error: err.message || "Could not update customer" });
    }
  });

  app.delete("/api/customers/:id", requireAuth, (req, res) => {
    try {
      const ok = loadDb().deleteCustomer(Number(req.params.id));
      if (!ok) return res.status(404).json({ error: "Not found" });
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Database unavailable" });
    }
  });

  if (!serverless) {
    app.use(express.static(path.join(__dirname, "..")));
    app.get("/admin", (_req, res) => {
      res.sendFile(path.join(__dirname, "..", "admin", "index.html"));
    });
    app.get("/admin/print/:id", (_req, res) => {
      res.sendFile(path.join(__dirname, "..", "admin", "print.html"));
    });
  }

  return app;
}

module.exports = { createDataApp };

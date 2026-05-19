const express = require("express");
const { verifyAdminPassword } = require("./auth-config");
const { sessionMiddleware, writeSession, clearSession } = require("./session-cookie");

function createAuthApp() {
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
    res.json({ ok: true });
  });

  app.post("/api/logout", requireAuth, (req, res) => {
    clearSession(res);
    req.session = null;
    res.json({ ok: true });
  });

  app.get("/api/session", (req, res) => {
    res.json({ authenticated: Boolean(req.session?.authenticated) });
  });

  return app;
}

module.exports = { createAuthApp };

const express = require("express");
const cookieSession = require("cookie-session");
const {
  getSessionSecret,
  verifyAdminPassword,
  isProductionHost,
} = require("./auth-config");

/** Auth-only Express app (no SQLite) — used by Netlify auth function and local server. */
function createAuthApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "1mb" }));
  app.use(
    cookieSession({
      name: "sa_admin_sess",
      keys: [getSessionSecret()],
      maxAge: 1000 * 60 * 60 * 12,
      httpOnly: true,
      sameSite: "lax",
      secure: isProductionHost(),
    })
  );

  function requireAuth(req, res, next) {
    if (req.session?.authenticated) return next();
    res.status(401).json({ error: "Unauthorized" });
  }

  app.post("/api/login", (req, res) => {
    const { password } = req.body || {};
    if (!verifyAdminPassword(password)) {
      return res.status(401).json({ error: "Invalid password" });
    }
    req.session = { authenticated: true };
    res.json({ ok: true });
  });

  app.post("/api/logout", requireAuth, (req, res) => {
    req.session = null;
    res.json({ ok: true });
  });

  app.get("/api/session", (req, res) => {
    res.json({ authenticated: Boolean(req.session?.authenticated) });
  });

  return app;
}

module.exports = { createAuthApp };

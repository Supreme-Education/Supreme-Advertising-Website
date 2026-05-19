const crypto = require("crypto");
const { getSessionSecret, isProductionHost } = require("./auth-config");

const COOKIE_NAME = "sa_admin_sess";
const MAX_AGE_SEC = 60 * 60 * 12;

function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;
  String(header)
    .split(";")
    .forEach((part) => {
      const idx = part.indexOf("=");
      if (idx === -1) return;
      const key = part.slice(0, idx).trim();
      const val = part.slice(idx + 1).trim();
      cookies[key] = decodeURIComponent(val);
    });
  return cookies;
}

function signSession(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", getSessionSecret()).update(data).digest("base64url");
  return `${data}.${sig}`;
}

function verifySessionToken(token) {
  if (!token) return false;
  const dot = token.lastIndexOf(".");
  if (dot === -1) return false;
  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto
    .createHmac("sha256", getSessionSecret())
    .update(data)
    .digest("base64url");
  if (sig.length !== expected.length) return false;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    return payload?.authenticated === true;
  } catch {
    return false;
  }
}

function buildSetCookie(value, maxAgeSec) {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSec}`,
  ];
  if (isProductionHost()) parts.push("Secure");
  return parts.join("; ");
}

function readSession(req) {
  const cookies = parseCookies(req.headers?.cookie);
  return verifySessionToken(cookies[COOKIE_NAME]) ? { authenticated: true } : null;
}

function writeSession(res, payload) {
  const token = signSession(payload);
  res.setHeader("Set-Cookie", buildSetCookie(token, MAX_AGE_SEC));
}

function clearSession(res) {
  res.setHeader("Set-Cookie", buildSetCookie("", 0));
}

/** Express middleware — works locally and in Netlify Functions. */
function sessionMiddleware(req, res, next) {
  req.session = readSession(req);
  next();
}

function resolveAuthAction(event) {
  const path = String(event.path || event.rawPath || "").toLowerCase();
  if (path.includes("session")) return "session";
  if (path.includes("login")) return "login";
  if (path.includes("logout")) return "logout";

  const method = (event.httpMethod || "GET").toUpperCase();
  if (method === "GET") return "session";
  if (method === "POST") {
    try {
      const body = JSON.parse(event.body || "{}");
      if (Object.prototype.hasOwnProperty.call(body, "password")) return "login";
    } catch {
      /* ignore */
    }
    return "logout";
  }
  return null;
}

/** Netlify Function handler (no Express). */
function handleAuthRequest(event) {
  const action = resolveAuthAction(event);
  const method = (event.httpMethod || "GET").toUpperCase();
  const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };

  const cookieHeader = event.headers?.cookie || event.headers?.Cookie || "";
  const isAuthed = verifySessionToken(parseCookies(cookieHeader)[COOKIE_NAME]);

  if (action === "session") {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ authenticated: isAuthed }),
    };
  }

  if (action === "login") {
    const { verifyAdminPassword } = require("./auth-config");
    let body = {};
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      body = {};
    }
    if (!verifyAdminPassword(body.password)) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: "Invalid password" }),
      };
    }
    const token = signSession({ authenticated: true });
    return {
      statusCode: 200,
      headers: { ...headers, "Set-Cookie": buildSetCookie(token, MAX_AGE_SEC) },
      body: JSON.stringify({ ok: true }),
    };
  }

  if (action === "logout") {
    return {
      statusCode: 200,
      headers: { ...headers, "Set-Cookie": buildSetCookie("", 0) },
      body: JSON.stringify({ ok: true }),
    };
  }

  return {
    statusCode: 404,
    headers,
    body: JSON.stringify({ error: "Not found" }),
  };
}

module.exports = {
  COOKIE_NAME,
  sessionMiddleware,
  readSession,
  writeSession,
  clearSession,
  handleAuthRequest,
  verifySessionToken,
};

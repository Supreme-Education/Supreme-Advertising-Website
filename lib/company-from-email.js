/** Personal / webmail domains — no business name from these. */
const GENERIC_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "yahoo.co.in",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "protonmail.com",
  "proton.me",
  "mail.com",
  "ymail.com",
  "rocketmail.com",
]);

const COUNTRY_TLDS = new Set(["lk", "uk", "au", "in", "us", "nz", "sg", "ae"]);
const GENERIC_TLDS = new Set(["com", "org", "net", "edu", "gov", "ac", "co"]);

/** Known clients — full company + address from email domain. */
const DOMAIN_OVERRIDES = {
  "dsityre.com": {
    company: "Samson Rubber Industries (Pvt) Ltd",
    address: "Jinasena Mawatha, Mahara, Kadawatha, Sri Lanka.",
  },
  "dsityre.lk": {
    company: "Samson Rubber Industries (Pvt) Ltd",
    address: "Jinasena Mawatha, Mahara, Kadawatha, Sri Lanka.",
  },
  "dsitire.lk": {
    company: "Samson Rubber Industries (Pvt) Ltd",
    address: "Jinasena Mawatha, Mahara, Kadawatha, Sri Lanka.",
  },
  "dsitire.com": {
    company: "Samson Rubber Industries (Pvt) Ltd",
    address: "Jinasena Mawatha, Mahara, Kadawatha, Sri Lanka.",
  },
  "lotustyre.com": {
    company: "Vechenson (Pvt) Ltd",
    address: "Uggalboda, Gampaha, Sri Lanka.",
  },
  "dsibike.com": {
    company: "Samson Bikes (Pvt) Ltd",
    address: "Nedungamuwa, Gampaha, Sri Lanka.",
  },
  "dsibike.lk": {
    company: "Samson Bikes (Pvt) Ltd",
    address: "Nedungamuwa, Gampaha, Sri Lanka.",
  },
  "mountspring.lk": {
    company: "Mount Spring Water (Pvt) Ltd.",
    address: "24, Kandy Road, Dalugama, Kelaniya.",
  },
  "seng.lk": {
    company: "Samson Engineers (Pvt) Ltd",
    address: "P.O. Box 03, Kandy Road, Kadawatha.",
  },
  "ranpa.lk": {
    company: "Samson Manufacturers (Pvt) Ltd",
    address: "No: 26, Ranmuthugala Estate, Gonahena, Kadawatha, Sri Lanka.",
  },
};

function emailDomain(email) {
  const match = String(email || "")
    .trim()
    .toLowerCase()
    .match(/^[^@]+@([^@]+)$/);
  return match ? match[1] : "";
}

function domainOverridesForEmail(email) {
  const domain = emailDomain(email);
  return domain ? DOMAIN_OVERRIDES[domain] || null : null;
}

function titleWords(text) {
  return String(text)
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Derive a display company name from a business email domain.
 * e.g. amila@ranpa.lk → "Ranpa", studioandrews@gmail.com → ""
 */
function companyFromEmail(email) {
  const override = domainOverridesForEmail(email);
  if (override) return override.company;

  const domain = emailDomain(email);
  if (!domain || GENERIC_DOMAINS.has(domain)) return "";

  const parts = domain.split(".").filter(Boolean);
  if (!parts.length) return "";

  while (parts.length > 1) {
    const last = parts[parts.length - 1];
    const prev = parts[parts.length - 2];
    if (last.length === 2 && COUNTRY_TLDS.has(last) && GENERIC_TLDS.has(prev)) {
      parts.pop();
      parts.pop();
      continue;
    }
    if (GENERIC_TLDS.has(last) || COUNTRY_TLDS.has(last)) {
      parts.pop();
      continue;
    }
    break;
  }

  const host = parts[0] || domain.split(".")[0];
  const label = host.replace(/[-_]+/g, " ").replace(/[^a-z0-9\s]/gi, " ").trim();
  if (!label || label.length < 2) return "";
  return titleWords(label);
}

function addressFromEmail(email) {
  const override = domainOverridesForEmail(email);
  return override ? override.address : "";
}

module.exports = {
  companyFromEmail,
  addressFromEmail,
  domainOverridesForEmail,
  GENERIC_DOMAINS,
};

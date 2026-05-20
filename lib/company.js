/** Bundled via require() so Netlify Functions can read company defaults. */
const company = require("./company.json");

function loadCompany() {
  return company;
}

module.exports = { loadCompany };

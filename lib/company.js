const fs = require("fs");
const path = require("path");

const companyPath = path.join(__dirname, "company.json");

function loadCompany() {
  return JSON.parse(fs.readFileSync(companyPath, "utf8"));
}

module.exports = { loadCompany };

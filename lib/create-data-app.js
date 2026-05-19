require("dotenv").config();
const { buildDataApp } = require("./data-routes");

function createDataApp(options = {}) {
  return buildDataApp(require("./db"), options);
}

module.exports = { createDataApp };

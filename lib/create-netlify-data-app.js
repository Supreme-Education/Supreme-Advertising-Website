const { buildDataApp } = require("./data-routes");
const store = require("./store-json");

function createNetlifyDataApp() {
  return buildDataApp(store, { serverless: true });
}

module.exports = { createNetlifyDataApp };

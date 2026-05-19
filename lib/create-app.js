const { createDataApp } = require("./create-data-app");

function createApp(options = {}) {
  return createDataApp(options);
}

module.exports = { createApp, createDataApp };

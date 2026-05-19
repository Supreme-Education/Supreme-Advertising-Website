const { createDataApp } = require("./create-data-app");

/** @deprecated Use createDataApp — kept for existing imports. */
function createApp(options = {}) {
  return createDataApp(options);
}

module.exports = { createApp, createDataApp };

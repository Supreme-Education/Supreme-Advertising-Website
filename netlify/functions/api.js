const serverless = require("serverless-http");
const { createDataApp } = require("../../lib/create-data-app");

let handler;

module.exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  try {
    if (!handler) {
      handler = serverless(createDataApp({ serverless: true }));
    }
    return await handler(event, context);
  } catch (err) {
    console.error("API function error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "API service unavailable" }),
    };
  }
};

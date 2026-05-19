const serverless = require("serverless-http");
const { createAuthApp } = require("../../lib/auth-app");

let handler;

module.exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  try {
    if (!handler) {
      handler = serverless(createAuthApp());
    }
    return await handler(event, context);
  } catch (err) {
    console.error("Auth function error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Auth service unavailable" }),
    };
  }
};

const serverless = require("serverless-http");
const { createNetlifyDataApp } = require("../../lib/create-netlify-data-app");

let handler;

module.exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  try {
    if (!handler) {
      handler = serverless(createNetlifyDataApp());
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

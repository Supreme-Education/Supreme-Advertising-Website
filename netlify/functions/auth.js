const { handleAuthRequest } = require("../../lib/session-cookie");

exports.handler = async (event) => {
  try {
    return handleAuthRequest(event);
  } catch (err) {
    console.error("Auth function error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Auth service unavailable", detail: err.message }),
    };
  }
};

const serverless = require("serverless-http");
const { createApp } = require("../../lib/create-app");

let handler;

module.exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  if (!handler) {
    handler = serverless(createApp());
  }
  return handler(event, context);
};

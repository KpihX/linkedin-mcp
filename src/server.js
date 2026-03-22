/**
 * linkedin-mcp — MCP server factory.
 *
 * The same logical MCP surface is reused by both transports:
 *   - stdio (local / fallback)
 *   - HTTP streamable (homelab deployment)
 */

"use strict";

const { Server }               = require("@modelcontextprotocol/sdk/server/index.js");
const { ListToolsRequestSchema, CallToolRequestSchema } = require("@modelcontextprotocol/sdk/types.js");
const pino                     = require("pino");
const { listTools, callTool }  = require("./tools/registry");

function createLogger(config) {
  return pino({ level: config.logging?.level || "error" }, pino.destination(2));
}

function createMcpServer(config, logger = createLogger(config)) {
  const server = new Server(
    { name: config.server.name, version: config.server.version },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: listTools(),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const ctx = { config };
    logger.info({ tool: name }, "CallTool");
    const result = await callTool(name, args, ctx);
    if (result.isError) logger.warn({ tool: name, result }, "Tool error");
    return result;
  });

  return server;
}

module.exports = { createLogger, createMcpServer };

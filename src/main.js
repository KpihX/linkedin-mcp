#!/usr/bin/env node
/**
 * linkedin-mcp — Transport entrypoint.
 *
 * Commands:
 *   serve       Start stdio MCP server (default — local / fallback use)
 *   serve-http  Start HTTP streamable MCP server (homelab deployment)
 */

"use strict";

const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { loadConfig }                    = require("./config");
const { createLogger, createMcpServer } = require("./server");
const { createHttpApp, bootstrapHttpRuntime } = require("./http_app");

async function serveStdio() {
  const config    = loadConfig();
  const logger    = createLogger(config);
  const server    = createMcpServer(config, logger);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("linkedin-mcp connected via stdio");
}

async function serveHttp() {
  const { app, config } = await createHttpApp();
  const logger          = createLogger(config);
  await bootstrapHttpRuntime();
  app.listen(config.server.http_port, config.server.http_host, () => {
    logger.info(
      {
        host: config.server.http_host,
        port: config.server.http_port,
        mcpPath: config.server.http_mcp_path,
      },
      "linkedin-mcp HTTP transport listening",
    );
  });
}

async function main(argv = process.argv.slice(2)) {
  const command = argv[0] || "serve";
  if (command === "serve" || command === "stdio") {
    await serveStdio();
    return;
  }
  if (command === "serve-http") {
    await serveHttp();
    return;
  }
  throw new Error(`Unknown command: ${command}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}

module.exports = { main, serveHttp, serveStdio };

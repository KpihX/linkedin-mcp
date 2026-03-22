/**
 * linkedin-mcp — HTTP surface.
 *
 * Routes:
 *   GET  /health                     liveness + token status
 *   GET  /admin/status               detailed runtime status
 *   GET  /admin/help                 capability reference
 *   GET  /admin/logs                 recent admin log lines (?lines=N)
 *   POST /admin/client-id/set        body: { "value": "..." }
 *   POST /admin/client-id/unset
 *   POST /admin/client-secret/set    body: { "value": "..." }
 *   POST /admin/client-secret/unset
 *   POST /admin/token/set            body: { "value": "..." }
 *   POST /admin/token/unset
 *   POST /mcp                        MCP streamable-HTTP transport
 *   GET  /mcp                        SSE stream (same session)
 *   DELETE /mcp                      session teardown
 */

"use strict";

const crypto  = require("crypto");
const express = require("express");
const { StreamableHTTPServerTransport } = require("@modelcontextprotocol/sdk/server/streamableHttp.js");

const { loadConfig }   = require("./config");
const { createLogger, createMcpServer } = require("./server");
const { tokenSummary } = require("./token");
const {
  adminHelpText,
  appendAdminLog,
  getLogsText,
  healthSummaryText,
  setAccessToken,
  setClientId,
  setClientSecret,
  statusSummaryText,
  unsetAccessToken,
  unsetClientId,
  unsetClientSecret,
  urlsSummary,
} = require("./admin/service");
const { startTelegramAdmin, telegramAdminEnabled, telegramAdminRuntimeStatus } = require("./admin/telegram");

// ── Payload factory ───────────────────────────────────────────────────────────

function _basePayload(config) {
  return {
    ok: true,
    product: "linkedin-mcp",
    service: "LinkedIn MCP transport bridge",
    version: config.server.version,
    transport: "streamable-http",
    mcp_path: config.server.http_mcp_path,
    public_base_url: config.server.public_base_url,
    fallback_base_url: config.server.fallback_base_url,
    listen_port: config.server.http_port,
    pid: process.pid,
    running: true,
  };
}

// ── Route handlers ────────────────────────────────────────────────────────────

function healthHandler(config) {
  return (_req, res) => {
    const payload = _basePayload(config);
    payload.auth  = tokenSummary(config);
    res.json(payload);
  };
}

function adminStatusHandler(config) {
  return (_req, res) => {
    const payload = _basePayload(config);
    payload.auth  = tokenSummary(config);
    payload.admin = {
      ssh_admin: {
        supported: true,
        examples: [
          "docker compose exec -T linkedin-mcp linkedin-admin status",
          "docker compose logs --tail=100 linkedin-mcp",
        ],
      },
      telegram_admin: {
        supported: true,
        token_env: "TELEGRAM_LINKEDIN_HOMELAB_TOKEN",
        allowed_chat_ids_env: "TELEGRAM_CHAT_IDS",
        configured: telegramAdminEnabled(),
        enabled: telegramAdminEnabled(),
        runtime: telegramAdminRuntimeStatus(),
      },
      status_summary: statusSummaryText(),
    };
    payload.routes = {
      health: "/health",
      admin_status: "/admin/status",
      admin_help: "/admin/help",
      admin_logs: "/admin/logs?lines=N",
      mcp: config.server.http_mcp_path,
    };
    res.json(payload);
  };
}

function adminHelpHandler(config) {
  return (_req, res) => {
    const payload  = _basePayload(config);
    payload.help   = adminHelpText();
    payload.health = healthSummaryText();
    payload.urls   = urlsSummary();
    payload.routes = {
      health: "/health",
      admin_status: "/admin/status",
      admin_help: "/admin/help",
      admin_logs: "/admin/logs?lines=N",
      mcp: config.server.http_mcp_path,
    };
    res.json(payload);
  };
}

function adminLogsHandler() {
  return (req, res) => {
    const limit = parseInt(req.query.lines || "50", 10);
    res.json({ ok: true, logs: getLogsText(Number.isNaN(limit) ? 50 : limit) });
  };
}

// ── Credential POST handlers ──────────────────────────────────────────────────

function adminClientIdSetHandler() {
  return (req, res) => {
    const { value } = req.body || {};
    if (!value) return res.status(400).json({ ok: false, error: "Missing 'value' in request body" });
    setClientId(String(value));
    res.json({ ok: true, action: "client-id set" });
  };
}

function adminClientIdUnsetHandler() {
  return (_req, res) => {
    unsetClientId();
    res.json({ ok: true, action: "client-id unset" });
  };
}

function adminClientSecretSetHandler() {
  return (req, res) => {
    const { value } = req.body || {};
    if (!value) return res.status(400).json({ ok: false, error: "Missing 'value' in request body" });
    setClientSecret(String(value));
    res.json({ ok: true, action: "client-secret set" });
  };
}

function adminClientSecretUnsetHandler() {
  return (_req, res) => {
    unsetClientSecret();
    res.json({ ok: true, action: "client-secret unset" });
  };
}

function adminTokenSetHandler() {
  return async (req, res) => {
    const { value } = req.body || {};
    if (!value) return res.status(400).json({ ok: false, error: "Missing 'value' in request body" });
    await setAccessToken(String(value));
    res.json({ ok: true, action: "token set" });
  };
}

function adminTokenUnsetHandler() {
  return (_req, res) => {
    unsetAccessToken();
    res.json({ ok: true, action: "token unset" });
  };
}

// ── App factory ───────────────────────────────────────────────────────────────

async function createHttpApp() {
  const config     = loadConfig();
  const logger     = createLogger(config);
  const app        = express();
  const transports = new Map();

  app.use(express.json({ limit: "1mb" }));

  // ── Read routes ───────────────────────────────────────────────────────────
  app.get("/health",       healthHandler(config));
  app.get("/admin/status", adminStatusHandler(config));
  app.get("/admin/help",   adminHelpHandler(config));
  app.get("/admin/logs",   adminLogsHandler());

  // ── Credential management routes ──────────────────────────────────────────
  app.post("/admin/client-id/set",        adminClientIdSetHandler());
  app.post("/admin/client-id/unset",      adminClientIdUnsetHandler());
  app.post("/admin/client-secret/set",    adminClientSecretSetHandler());
  app.post("/admin/client-secret/unset",  adminClientSecretUnsetHandler());
  app.post("/admin/token/set",            adminTokenSetHandler());
  app.post("/admin/token/unset",          adminTokenUnsetHandler());

  // ── MCP transport ─────────────────────────────────────────────────────────
  const mcpPost = async (req, res) => {
    const sessionId = req.headers["mcp-session-id"];
    try {
      let transport;
      if (sessionId && transports.has(sessionId)) {
        transport = transports.get(sessionId);
      } else if (!sessionId && req.body?.method === "initialize") {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => crypto.randomUUID(),
          onsessioninitialized: (id) => transports.set(id, transport),
        });
        transport.onclose = () => {
          if (transport.sessionId) transports.delete(transport.sessionId);
        };
        const server = createMcpServer(config, logger);
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
        return;
      } else {
        res.status(400).json({
          jsonrpc: "2.0",
          error: { code: -32000, message: "Bad Request: No valid session ID" },
          id: null,
        });
        return;
      }
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      logger.error({ err }, "Error handling MCP POST");
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  };

  app.post(config.server.http_mcp_path, mcpPost);
  app.get(config.server.http_mcp_path, async (req, res) => {
    const sessionId = req.headers["mcp-session-id"];
    if (!sessionId || !transports.has(sessionId)) {
      return res.status(400).send("Invalid or missing session ID");
    }
    await transports.get(sessionId).handleRequest(req, res);
  });
  app.delete(config.server.http_mcp_path, async (req, res) => {
    const sessionId = req.headers["mcp-session-id"];
    if (!sessionId || !transports.has(sessionId)) {
      return res.status(400).send("Invalid or missing session ID");
    }
    await transports.get(sessionId).handleRequest(req, res);
  });

  return { app, config };
}

async function bootstrapHttpRuntime() {
  appendAdminLog("http runtime bootstrap started");
  startTelegramAdmin();
}

module.exports = {
  adminHelpHandler,
  adminLogsHandler,
  adminStatusHandler,
  bootstrapHttpRuntime,
  createHttpApp,
  healthHandler,
};

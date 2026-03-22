/**
 * linkedin-mcp — Shared admin helpers.
 *
 * Provides status summaries used by CLI, HTTP admin endpoints, and Telegram bot.
 */

"use strict";

const fs   = require("fs");
const os   = require("os");
const path = require("path");

const { loadConfig }   = require("../config");
const { tokenSummary } = require("../token");

// ── Path helpers ─────────────────────────────────────────────────────────────

function stateDir() {
  const cfg = loadConfig();
  return (cfg.server?.state_directory || "~/.mcps/linkedin").replace(/^~/, os.homedir());
}

function logFile() {
  return path.join(stateDir(), "linkedin-admin.log");
}

function appendAdminLog(message) {
  fs.mkdirSync(stateDir(), { recursive: true });
  const line = `${new Date().toISOString()} ${message}\n`;
  fs.appendFileSync(logFile(), line, "utf-8");
}

function getLogsText(limit = 50) {
  const file = logFile();
  if (!fs.existsSync(file)) return "No admin log lines available.";
  const lines = fs.readFileSync(file, "utf-8").split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return "No admin log lines available.";
  return lines.slice(-Math.max(1, limit)).join("\n");
}

// ── Status helpers ────────────────────────────────────────────────────────────

function statusSummaryText() {
  const cfg     = loadConfig();
  const summary = tokenSummary(cfg);
  const lines   = [
    "linkedin-admin status",
    `- service: ${cfg.server.name} ${cfg.server.version}`,
    `- state directory: ${stateDir()}`,
    `- token present: ${summary.present ? "yes" : "no"}`,
    `- token valid: ${summary.valid ? `yes (${summary.days_left} days left)` : "no"}`,
  ];
  if (summary.valid) {
    lines.push(`- member: ${summary.name || "?"} (${summary.email || "?"})`);
    lines.push(`- expires: ${summary.expires_at}`);
  } else if (summary.present && !summary.valid) {
    lines.push("- action needed: run 'linkedin-admin auth' to re-authenticate");
  } else {
    lines.push("- action needed: run 'linkedin-admin auth' to authenticate");
  }
  return lines.join("\n");
}

function healthSummaryText() {
  const cfg = loadConfig();
  return [
    "linkedin-mcp health",
    `- public: ${cfg.server.public_base_url}`,
    `- fallback: ${cfg.server.fallback_base_url}`,
    `- mcp: ${cfg.server.public_base_url}${cfg.server.http_mcp_path}`,
    `- local port: ${cfg.server.http_port}`,
  ].join("\n");
}

function urlsSummary() {
  const cfg = loadConfig();
  return [
    "linkedin-mcp URLs",
    `- public: ${cfg.server.public_base_url}`,
    `- fallback: ${cfg.server.fallback_base_url}`,
    `- mcp: ${cfg.server.public_base_url}${cfg.server.http_mcp_path}`,
    `- health: ${cfg.server.public_base_url}/health`,
    `- admin status: ${cfg.server.public_base_url}/admin/status`,
    `- admin help: ${cfg.server.public_base_url}/admin/help`,
  ].join("\n");
}

function adminHelpText() {
  return [
    "linkedin-admin capabilities",
    "- CLI:",
    "  - linkedin-admin auth",
    "  - linkedin-admin status [--json]",
    "  - linkedin-admin logout",
    "  - linkedin-admin logs [--lines N]",
    "  - linkedin-admin health",
    "  - linkedin-admin urls",
    "- HTTP:",
    "  - GET /health",
    "  - GET /admin/status",
    "  - GET /admin/help",
    "  - GET /admin/logs?lines=N",
    "- Telegram:",
    "  - /start",
    "  - /help",
    "  - /status",
    "  - /health",
    "  - /urls",
    "  - /logs [lines]",
  ].join("\n");
}

module.exports = {
  adminHelpText,
  appendAdminLog,
  getLogsText,
  healthSummaryText,
  logFile,
  stateDir,
  statusSummaryText,
  urlsSummary,
};

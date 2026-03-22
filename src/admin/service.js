/**
 * linkedin-mcp — Shared admin helpers.
 *
 * Provides status summaries used by CLI, HTTP admin endpoints, and Telegram bot.
 * Secret resolution uses the 2-tier chain from config.js (process env → login shell).
 */

"use strict";

const fs   = require("fs");
const os   = require("os");
const path = require("path");

const { loadConfig, resolveEnv, ENV_VARS } = require("../config");
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

// ── Secret status helpers ─────────────────────────────────────────────────────

/**
 * Mask a secret value: show first 4 + last 4 chars with … in the middle.
 * Returns "-" if value is absent.
 */
function _maskValue(value) {
  if (!value) return "-";
  if (value.length <= 8) return "****";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

/**
 * Resolve all tracked secrets and return their status rows.
 * Each row: { name, present, masked, source }
 */
function getSecretsStatus() {
  const tracked = [
    { name: ENV_VARS.clientId,      label: ENV_VARS.clientId },
    { name: ENV_VARS.clientSecret,  label: ENV_VARS.clientSecret },
    { name: ENV_VARS.telegramToken, label: ENV_VARS.telegramToken },
  ];

  return tracked.map(({ label }) => {
    const { value, source } = resolveEnv(label);
    return {
      name:    label,
      present: Boolean(value),
      masked:  _maskValue(value),
      source,
    };
  });
}

// ── Status helpers ────────────────────────────────────────────────────────────

function statusSummaryText() {
  const cfg     = loadConfig();
  const summary = tokenSummary(cfg);
  const secrets = getSecretsStatus();

  const lines = [
    `linkedin-mcp — ${cfg.server.name} ${cfg.server.version}`,
    "",
    "Token:",
    `  present : ${summary.present ? "yes" : "no"}`,
    `  valid   : ${summary.valid ? `yes (${summary.days_left} days left)` : "no"}`,
  ];

  if (summary.valid) {
    lines.push(`  member  : ${summary.name || "?"} <${summary.email || "?"}>`);
    lines.push(`  expires : ${summary.expires_at}`);
  } else if (summary.present && !summary.valid) {
    lines.push("  action  : run 'linkedin-admin auth' to re-authenticate");
  } else {
    lines.push("  action  : run 'linkedin-admin auth' to authenticate");
  }

  lines.push("");
  lines.push("Secrets:");
  for (const s of secrets) {
    const status = s.present ? "✓ set" : "✗ missing";
    lines.push(`  ${s.name.padEnd(35)} ${status.padEnd(12)} ${s.masked.padEnd(14)} ${s.source}`);
  }

  return lines.join("\n");
}

function healthSummaryText() {
  const cfg = loadConfig();
  return [
    "linkedin-mcp health",
    `  port    : ${cfg.server.http_port}`,
    `  public  : ${cfg.server.public_base_url}`,
    `  fallback: ${cfg.server.fallback_base_url}`,
    `  mcp     : ${cfg.server.public_base_url}${cfg.server.http_mcp_path}`,
    `  health  : ${cfg.server.public_base_url}/health`,
  ].join("\n");
}

function urlsSummary() {
  const cfg = loadConfig();
  return [
    "linkedin-mcp URLs",
    `  public  : ${cfg.server.public_base_url}`,
    `  fallback: ${cfg.server.fallback_base_url}`,
    `  mcp     : ${cfg.server.public_base_url}${cfg.server.http_mcp_path}`,
    `  health  : ${cfg.server.public_base_url}/health`,
    `  status  : ${cfg.server.public_base_url}/admin/status`,
    `  help    : ${cfg.server.public_base_url}/admin/help`,
    `  logs    : ${cfg.server.public_base_url}/admin/logs`,
  ].join("\n");
}

function adminHelpText() {
  return [
    "linkedin-admin — MCP server for LinkedIn",
    "",
    "CLI:",
    "  linkedin-admin auth             Start OAuth 2.0 flow",
    "  linkedin-admin status [--json]  Token + secrets status",
    "  linkedin-admin logout           Clear stored token",
    "  linkedin-admin logs [--lines N] Tail admin log",
    "  linkedin-admin health           HTTP endpoints info",
    "  linkedin-admin urls             All public URLs",
    "",
    "HTTP:",
    "  GET /health",
    "  GET /admin/status",
    "  GET /admin/help",
    "  GET /admin/logs?lines=N",
    "",
    "Telegram:",
    "  /start | /help",
    "  /status",
    "  /health",
    "  /urls",
    "  /logs [lines]",
  ].join("\n");
}

module.exports = {
  adminHelpText,
  appendAdminLog,
  getLogsText,
  getSecretsStatus,
  healthSummaryText,
  logFile,
  stateDir,
  statusSummaryText,
  urlsSummary,
};

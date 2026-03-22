/**
 * linkedin-mcp — Shared admin helpers.
 *
 * Provides status summaries and credential management used by CLI, HTTP admin
 * endpoints, and Telegram bot. This is the single source of truth for admin
 * logic — CLI/HTTP/Telegram only adjust the rendering format.
 *
 * Credential management:
 *   - client-id / client-secret → written to admin env file (LINKEDIN_ADMIN_ENV_FILE)
 *   - token (access token)      → written to token.json via saveToken / clearToken
 */

"use strict";

const fs   = require("fs");
const os   = require("os");
const path = require("path");

const { loadConfig, resolveEnv, ENV_VARS } = require("../config");
const { tokenSummary, saveToken, clearToken } = require("../token");

// ── Admin env file path ───────────────────────────────────────────────────────

/**
 * Resolve the path to the admin env file.
 * Priority: LINKEDIN_ADMIN_ENV_FILE env var → stateDir/linkedin-admin.env
 */
function adminEnvFilePath() {
  const fromEnv = process.env[ENV_VARS.adminEnvFile];
  if (fromEnv) return fromEnv;
  return path.join(stateDir(), "linkedin-admin.env");
}

// ── Path helpers ──────────────────────────────────────────────────────────────

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

// ── Admin env file helpers ────────────────────────────────────────────────────

/**
 * Write (or update) a key=value pair in the admin env file.
 * Also caches the value in process.env immediately.
 */
function _writeEnvKey(file, key, value) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });

  let lines = [];
  if (fs.existsSync(file)) {
    lines = fs.readFileSync(file, "utf-8").split(/\r?\n/);
    // Strip trailing empty line if any
    while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  }

  const prefix = `${key}=`;
  let found = false;
  const updated = lines.map((line) => {
    if (line.startsWith(prefix)) { found = true; return `${key}=${value}`; }
    return line;
  });
  if (!found) updated.push(`${key}=${value}`);

  fs.writeFileSync(file, updated.join("\n") + "\n", "utf-8");
  process.env[key] = value;
}

/**
 * Remove a key from the admin env file.
 * Also removes the value from process.env.
 */
function _clearEnvKey(file, key) {
  if (fs.existsSync(file)) {
    const lines = fs.readFileSync(file, "utf-8").split(/\r?\n/);
    const prefix = `${key}=`;
    const updated = lines.filter((line) => !line.startsWith(prefix));
    while (updated.length > 0 && updated[updated.length - 1] === "") updated.pop();
    fs.writeFileSync(file, updated.length > 0 ? updated.join("\n") + "\n" : "", "utf-8");
  }
  delete process.env[key];
}

// ── Credential management ─────────────────────────────────────────────────────

function setClientId(value) {
  _writeEnvKey(adminEnvFilePath(), ENV_VARS.clientId, value);
  appendAdminLog(`client-id set (${_maskValue(value)})`);
}

function unsetClientId() {
  _clearEnvKey(adminEnvFilePath(), ENV_VARS.clientId);
  appendAdminLog("client-id unset");
}

function setClientSecret(value) {
  _writeEnvKey(adminEnvFilePath(), ENV_VARS.clientSecret, value);
  appendAdminLog(`client-secret set (${_maskValue(value)})`);
}

function unsetClientSecret() {
  _clearEnvKey(adminEnvFilePath(), ENV_VARS.clientSecret);
  appendAdminLog("client-secret unset");
}

/**
 * Persist an access token directly (bypasses OAuth flow).
 * Writes to token.json with a 60-day default expiry.
 */
function setAccessToken(value) {
  const config = loadConfig();
  saveToken(config, { access_token: value, expires_in: 5184000 });
  appendAdminLog(`token set (${_maskValue(value)})`);
}

/**
 * Clear the stored access token (logout).
 */
function unsetAccessToken() {
  const config = loadConfig();
  clearToken(config);
  appendAdminLog("token unset (logout)");
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
 * Read the raw access_token from token.json for masking purposes.
 */
function _rawTokenFromFile() {
  const tokenPath = path.join(stateDir(), "token.json");
  if (!fs.existsSync(tokenPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(tokenPath, "utf-8")).access_token || null;
  } catch {
    return null;
  }
}

/**
 * Resolve all tracked credentials and return their status rows.
 *
 * Tracked credentials:
 *   - LINKEDIN_CLIENT_ID     — env-based (process.env / login shell)
 *   - LINKEDIN_CLIENT_SECRET — env-based (process.env / login shell)
 *   - OAuth Token            — file-based (token.json)
 *
 * Each row: { name, present, masked, source }
 */
function getSecretsStatus() {
  const envSecrets = [ENV_VARS.clientId, ENV_VARS.clientSecret];

  const rows = envSecrets.map((name) => {
    const { value, source } = resolveEnv(name);
    return { name, present: Boolean(value), masked: _maskValue(value), source };
  });

  // OAuth Token row — sourced from token.json
  const cfg     = loadConfig();
  const summary = tokenSummary(cfg);
  const rawToken = _rawTokenFromFile();

  rows.push({
    name:    "OAuth Token",
    present: summary.valid,
    masked:  _maskValue(rawToken),
    source:  summary.present ? "token.json" : "missing",
  });

  return rows;
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
    lines.push("  action  : run 'linkedin-admin auth' or 'linkedin-admin token set <value>'");
  }

  lines.push("");
  lines.push("Credentials:");
  for (const s of secrets) {
    const status = s.present ? "✓ set" : "✗ missing";
    lines.push(`  ${s.name.padEnd(30)} ${status.padEnd(12)} ${s.masked.padEnd(14)} ${s.source}`);
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
    "  linkedin-admin auth [--port N]         Start OAuth 2.0 flow",
    "  linkedin-admin status [--json]         Credentials + token status",
    "  linkedin-admin logout                  Clear stored token",
    "  linkedin-admin logs [--lines N]        Tail admin log",
    "  linkedin-admin health                  HTTP endpoints info",
    "  linkedin-admin urls                    All public URLs",
    "  linkedin-admin client-id set <value>   Set LINKEDIN_CLIENT_ID",
    "  linkedin-admin client-id unset         Clear LINKEDIN_CLIENT_ID",
    "  linkedin-admin client-secret set <v>   Set LINKEDIN_CLIENT_SECRET",
    "  linkedin-admin client-secret unset     Clear LINKEDIN_CLIENT_SECRET",
    "  linkedin-admin token set <value>       Set access token directly",
    "  linkedin-admin token unset             Clear access token (logout)",
    "",
    "HTTP:",
    "  GET  /health",
    "  GET  /admin/status",
    "  GET  /admin/help",
    "  GET  /admin/logs?lines=N",
    "  POST /admin/client-id/set       body: { \"value\": \"...\" }",
    "  POST /admin/client-id/unset",
    "  POST /admin/client-secret/set   body: { \"value\": \"...\" }",
    "  POST /admin/client-secret/unset",
    "  POST /admin/token/set           body: { \"value\": \"...\" }",
    "  POST /admin/token/unset",
    "",
    "Telegram:",
    "  /start | /help",
    "  /status",
    "  /health",
    "  /urls",
    "  /logs [lines]",
    "  /token_set <access_token>",
    "  /token_unset",
    "  /client_id_set <value>",
    "  /client_id_unset",
    "  /client_secret_set <value>",
    "  /client_secret_unset",
  ].join("\n");
}

module.exports = {
  adminEnvFilePath,
  adminHelpText,
  appendAdminLog,
  getLogsText,
  getSecretsStatus,
  healthSummaryText,
  logFile,
  setAccessToken,
  setClientId,
  setClientSecret,
  stateDir,
  statusSummaryText,
  unsetAccessToken,
  unsetClientId,
  unsetClientSecret,
  urlsSummary,
};

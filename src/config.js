/**
 * linkedin-mcp — Configuration loader.
 *
 * Secret resolution — 2-tier chain (same philosophy as tick-mcp):
 *   Tier 1: process.env  (includes src/.env loaded at startup — non-empty values only)
 *   Tier 2: login shell  (zsh -l -c) — reads bw-env / kshrc secrets
 *
 * Non-secret settings priority (lowest → highest):
 *   1. DEFAULTS (hardcoded)
 *   2. config.json (project root)
 *   3. Environment variable overrides
 */

"use strict";

const fs            = require("fs");
const path          = require("path");
const { spawnSync } = require("child_process");

const CONFIG_FILE  = path.join(__dirname, "..", "config.json");
const PACKAGE_JSON = require(path.join(__dirname, "..", "package.json"));
const ENV_FILE     = path.join(__dirname, ".env");

// ── Canonical env var names (single source of truth) ─────────────────────────

const ENV_VARS = {
  clientId:           "LINKEDIN_CLIENT_ID",
  clientSecret:       "LINKEDIN_CLIENT_SECRET",
  accessToken:        "LINKEDIN_ACCESS_TOKEN",
  telegramToken:      "TELEGRAM_LINKEDIN_HOMELAB_TOKEN",
  telegramChatIds:    "TELEGRAM_CHAT_IDS",
  stateDir:           "LINKEDIN_STATE_DIR",
  adminEnvFile:       "LINKEDIN_ADMIN_ENV_FILE",
  httpHost:           "LINKEDIN_MCP_HTTP_HOST",
  httpPort:           "LINKEDIN_MCP_HTTP_PORT",
  httpPath:           "LINKEDIN_MCP_HTTP_PATH",
  publicUrl:          "LINKEDIN_MCP_PUBLIC_URL",
  logLevel:           "LINKEDIN_MCP_LOG_LEVEL",
};

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULTS = {
  server: {
    state_directory:  "~/.mcps/linkedin",
    http_host:        "127.0.0.1",
    http_port:        8095,
    http_mcp_path:    "/mcp",
    public_base_url:  "https://linkedin.kpihx-labs.com",
    fallback_base_url:"https://linkedin.homelab",
  },
  oauth: {
    redirect_port: 3001,
    redirect_uri:  "http://localhost:3001/callback",
    scopes:        ["openid", "profile", "email", "w_member_social"],
  },
  logging: {
    level: "error",
  },
};

// ── Deep merge ────────────────────────────────────────────────────────────────

function _merge(a, b) {
  for (const key of Object.keys(b)) {
    if (
      a[key] &&
      typeof a[key] === "object" &&
      !Array.isArray(a[key]) &&
      typeof b[key] === "object" &&
      !Array.isArray(b[key])
    ) {
      _merge(a[key], b[key]);
    } else {
      a[key] = b[key];
    }
  }
  return a;
}

// ── .env loader (non-empty values only, does not clobber inherited secrets) ───

function _loadEnvFile() {
  if (!fs.existsSync(ENV_FILE)) return;
  const raw = fs.readFileSync(ENV_FILE, "utf-8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key   = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    // Only set non-empty values; blank placeholders must not clobber inherited secrets
    if (value) process.env[key] = value;
  }
}

// ── Tier 2: login shell read ──────────────────────────────────────────────────

function _shellReadEnv(key) {
  try {
    const result = spawnSync("zsh", ["-l", "-c", `printf "%s" "\${${key}}"`], {
      encoding: "utf-8",
      timeout:  5000,
    });
    const val = (result.stdout || "").trim();
    return val || null;
  } catch {
    return null;
  }
}

// ── resolveEnv: 2-tier with source tracking ───────────────────────────────────
//
// Returns { value: string|null, source: "process env"|"login shell (zsh -l)"|"missing" }

function resolveEnv(key) {
  const fromEnv = process.env[key];
  if (fromEnv) return { value: fromEnv, source: "process env" };

  const fromShell = _shellReadEnv(key);
  if (fromShell) {
    process.env[key] = fromShell; // cache so subsequent calls are free
    return { value: fromShell, source: "login shell (zsh -l)" };
  }

  return { value: null, source: "missing" };
}

// ── loadConfig ────────────────────────────────────────────────────────────────

function loadConfig() {
  _loadEnvFile();

  const config = JSON.parse(JSON.stringify(DEFAULTS));
  config.server.name    = PACKAGE_JSON.name;
  config.server.version = PACKAGE_JSON.version;

  if (fs.existsSync(CONFIG_FILE)) {
    _merge(config, JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8")));
  }

  // Non-secret server overrides
  if (process.env[ENV_VARS.stateDir])  config.server.state_directory = process.env[ENV_VARS.stateDir];
  if (process.env[ENV_VARS.httpHost])  config.server.http_host        = process.env[ENV_VARS.httpHost];
  if (process.env[ENV_VARS.httpPort])  config.server.http_port        = parseInt(process.env[ENV_VARS.httpPort], 10);
  if (process.env[ENV_VARS.httpPath])  config.server.http_mcp_path    = process.env[ENV_VARS.httpPath];
  if (process.env[ENV_VARS.publicUrl]) config.server.public_base_url  = process.env[ENV_VARS.publicUrl];
  if (process.env[ENV_VARS.logLevel])  config.logging.level           = process.env[ENV_VARS.logLevel];

  // OAuth secrets — resolved through 2-tier chain (NOT hardcoded into config object)
  // client.js and oauth.js must call resolveEnv() directly at runtime.
  config.oauth.client_id     = resolveEnv(ENV_VARS.clientId).value     || "";
  config.oauth.client_secret = resolveEnv(ENV_VARS.clientSecret).value || "";
  config.oauth.access_token  = resolveEnv(ENV_VARS.accessToken).value  || "";

  return config;
}

module.exports = { loadConfig, resolveEnv, ENV_VARS, DEFAULTS };

/**
 * linkedin-mcp — Configuration loader.
 *
 * Priority (lowest → highest):
 *   1. DEFAULTS (hardcoded)
 *   2. config.json (project root)
 *   3. src/.env  (optional local overrides — never committed)
 *   4. Environment variables
 */

"use strict";

const fs   = require("fs");
const path = require("path");

const CONFIG_FILE  = path.join(__dirname, "..", "config.json");
const PACKAGE_JSON = require(path.join(__dirname, "..", "package.json"));
const ENV_FILE     = path.join(__dirname, ".env");

const DEFAULTS = {
  server: {
    state_directory: "~/.mcps/linkedin",
    http_host: "127.0.0.1",
    http_port: 8095,
    http_mcp_path: "/mcp",
    public_base_url: "https://linkedin.kpihx-labs.com",
    fallback_base_url: "https://linkedin.homelab",
  },
  oauth: {
    redirect_port: 3000,
    redirect_uri: "http://localhost:3000/callback",
    scopes: ["openid", "profile", "email", "w_member_social"],
  },
  logging: {
    level: "error",
  },
};

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

function _loadEnvFile() {
  if (!fs.existsSync(ENV_FILE)) return;
  const raw = fs.readFileSync(ENV_FILE, "utf-8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key   = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1);
    if (!process.env[key]) process.env[key] = value;
  }
}

/**
 * Load and return the merged configuration object.
 */
function loadConfig() {
  _loadEnvFile();
  const config = JSON.parse(JSON.stringify(DEFAULTS));
  config.server.name    = PACKAGE_JSON.name;
  config.server.version = PACKAGE_JSON.version;

  if (fs.existsSync(CONFIG_FILE)) {
    _merge(config, JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8")));
  }

  // Environment variable overrides
  if (process.env.LINKEDIN_STATE_DIR)       config.server.state_directory   = process.env.LINKEDIN_STATE_DIR;
  if (process.env.LINKEDIN_MCP_HTTP_HOST)   config.server.http_host         = process.env.LINKEDIN_MCP_HTTP_HOST;
  if (process.env.LINKEDIN_MCP_HTTP_PORT)   config.server.http_port         = parseInt(process.env.LINKEDIN_MCP_HTTP_PORT, 10);
  if (process.env.LINKEDIN_MCP_HTTP_PATH)   config.server.http_mcp_path     = process.env.LINKEDIN_MCP_HTTP_PATH;
  if (process.env.LINKEDIN_MCP_PUBLIC_URL)  config.server.public_base_url   = process.env.LINKEDIN_MCP_PUBLIC_URL;
  if (process.env.LINKEDIN_MCP_LOG_LEVEL)   config.logging.level            = process.env.LINKEDIN_MCP_LOG_LEVEL;

  // OAuth credentials (read-only in config, not embedded — used by client.js)
  config.oauth.client_id     = process.env.LINKEDIN_CLIENT_ID     || "";
  config.oauth.client_secret = process.env.LINKEDIN_CLIENT_SECRET || "";
  config.oauth.access_token  = process.env.LINKEDIN_ACCESS_TOKEN  || "";

  return config;
}

module.exports = { loadConfig, DEFAULTS };

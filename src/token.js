/**
 * linkedin-mcp — Token storage.
 *
 * Persists the OAuth access token to disk at:
 *   <state_directory>/token.json
 *
 * LinkedIn personal tokens last 60 days. No refresh flow for non-partner apps.
 */

"use strict";

const fs   = require("fs");
const os   = require("os");
const path = require("path");

function _resolveStateDir(config) {
  const raw = config.server.state_directory || "~/.mcps/linkedin";
  return raw.startsWith("~") ? path.join(os.homedir(), raw.slice(1)) : raw;
}

function _tokenPath(config) {
  return path.join(_resolveStateDir(config), "token.json");
}

/**
 * Save an access token to disk.
 * @param {object} config
 * @param {object} tokenData  { access_token, expires_in, member_id, name, email }
 */
function saveToken(config, tokenData) {
  const dir = _resolveStateDir(config);
  fs.mkdirSync(dir, { recursive: true });
  const payload = {
    ...tokenData,
    saved_at: Date.now(),
    expires_at: Date.now() + (tokenData.expires_in || 5184000) * 1000,
  };
  fs.writeFileSync(_tokenPath(config), JSON.stringify(payload, null, 2), "utf-8");
}

/**
 * Load the persisted token. Returns null if absent or expired.
 */
function loadToken(config) {
  const p = _tokenPath(config);
  if (!fs.existsSync(p)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(p, "utf-8"));
    if (data.expires_at && Date.now() > data.expires_at) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Delete the persisted token (logout).
 */
function clearToken(config) {
  const p = _tokenPath(config);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

/**
 * Return a summary of the token state for admin/status display.
 */
function tokenSummary(config) {
  const p = _tokenPath(config);
  if (!fs.existsSync(p)) {
    return { present: false, valid: false, token_path: p };
  }
  try {
    const data = JSON.parse(fs.readFileSync(p, "utf-8"));
    const now = Date.now();
    const expired = data.expires_at ? now > data.expires_at : false;
    const days_left = data.expires_at
      ? Math.max(0, Math.floor((data.expires_at - now) / 86400000))
      : null;
    return {
      present: true,
      valid: !expired,
      expired,
      days_left,
      member_id: data.member_id || null,
      name: data.name || null,
      email: data.email || null,
      saved_at: data.saved_at ? new Date(data.saved_at).toISOString() : null,
      expires_at: data.expires_at ? new Date(data.expires_at).toISOString() : null,
      token_path: p,
    };
  } catch {
    return { present: true, valid: false, corrupted: true, token_path: p };
  }
}

module.exports = { saveToken, loadToken, clearToken, tokenSummary };

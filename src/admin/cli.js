#!/usr/bin/env node
/**
 * linkedin-mcp — Admin CLI (linkedin-admin).
 *
 * Commands:
 *   auth [--port N]          Start OAuth 2.0 flow (opens browser, saves token)
 *   status [--json]          Show credentials + token status table
 *   logout                   Clear stored token
 *   logs [--lines N]         Tail the admin log
 *   health                   Show HTTP endpoint URLs
 *   urls                     Show all public URLs
 *   client-id set <value>    Set LINKEDIN_CLIENT_ID in admin env file
 *   client-id unset          Clear LINKEDIN_CLIENT_ID from admin env file
 *   client-secret set <v>    Set LINKEDIN_CLIENT_SECRET in admin env file
 *   client-secret unset      Clear LINKEDIN_CLIENT_SECRET from admin env file
 *   token set <value>        Set access token directly (bypasses OAuth)
 *   token unset              Clear stored access token (logout)
 */

"use strict";

const { Command } = require("commander");

const { loadConfig, resolveEnv, ENV_VARS } = require("../config");
const { tokenSummary, clearToken }         = require("../token");
const { runOAuthFlow }                     = require("./oauth");
const {
  adminEnvFilePath,
  adminHelpText,
  appendAdminLog,
  getLogsText,
  getSecretsStatus,
  healthSummaryText,
  setAccessToken,
  setClientId,
  setClientSecret,
  statusSummaryText,
  unsetAccessToken,
  unsetClientId,
  unsetClientSecret,
  urlsSummary,
} = require("./service");

const PKG = require("../../package.json");

// ── Simple Rich-style table renderer ─────────────────────────────────────────

function _pad(str, len) {
  return String(str || "").padEnd(len);
}

function _printStatusTable(title, rows) {
  // rows: [{ variable, status, masked, source }]
  const cols = [
    { key: "variable", label: "Variable",       width: 36 },
    { key: "status",   label: "Status",         width: 11 },
    { key: "masked",   label: "Value (masked)",  width: 16 },
    { key: "source",   label: "Source",          width: 24 },
  ];
  const tl = "╭", tr = "╮", bl = "╰", br = "╯";
  const ml = "├", mr = "┤", cross = "┼";
  const vl = "│";
  const hl = "─";

  const totalWidth = cols.reduce((s, c) => s + c.width + 3, 1);

  // Top border
  let top = tl;
  cols.forEach((c, i) => {
    top += hl.repeat(c.width + 2);
    top += (i < cols.length - 1) ? "┬" : tr;
  });

  // Header row
  let header = vl;
  cols.forEach((c) => {
    header += ` ${_pad(c.label, c.width)} ${vl}`;
  });

  // Middle separator
  let mid = ml;
  cols.forEach((c, i) => {
    mid += hl.repeat(c.width + 2);
    mid += (i < cols.length - 1) ? cross : mr;
  });

  // Bottom border
  let bot = bl;
  cols.forEach((c, i) => {
    bot += hl.repeat(c.width + 2);
    bot += (i < cols.length - 1) ? "┴" : br;
  });

  const titlePad = Math.floor((totalWidth - 2 - title.length) / 2);
  console.log(" ".repeat(Math.max(0, titlePad)) + title);
  console.log(top);
  console.log(header);
  console.log(mid);

  rows.forEach((r, idx) => {
    let row = vl;
    row += ` ${_pad(r.variable, cols[0].width)} ${vl}`;
    row += ` ${_pad(r.status,   cols[1].width)} ${vl}`;
    row += ` ${_pad(r.masked,   cols[2].width)} ${vl}`;
    row += ` ${_pad(r.source,   cols[3].width)} ${vl}`;
    console.log(row);
    if (idx < rows.length - 1) console.log(mid);
  });

  console.log(bot);
}

// ── CLI program ───────────────────────────────────────────────────────────────

const program = new Command();
program
  .name("linkedin-admin")
  .description("linkedin-mcp administration: auth, status, logout, logs, credential management")
  .version(PKG.version);

// ── auth ─────────────────────────────────────────────────────────────────────

program
  .command("auth")
  .description("Start LinkedIn OAuth 2.0 flow. Opens a browser for authorization.")
  .option("--port <n>", "Local callback port (default 3000)", "3000")
  .action(async (opts) => {
    const config = loadConfig();
    if (!config.oauth.client_id || !config.oauth.client_secret) {
      console.error(
        "\nError: LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET are not set.\n" +
        "Steps:\n" +
        "  1. Create app at https://developer.linkedin.com\n" +
        "  2. Add products: 'Sign In with LinkedIn using OpenID Connect' + 'Share on LinkedIn'\n" +
        "  3. Set redirect URI: http://localhost:<port>/callback\n" +
        "  4. Store credentials via bw-env: LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET\n" +
        "     or: linkedin-admin client-id set <value>\n",
      );
      process.exit(1);
    }
    const port = parseInt(opts.port, 10) || 3000;
    console.log("\nStarting LinkedIn OAuth flow...");
    console.log(`Redirect URI : http://localhost:${port}/callback`);
    console.log(`Scopes       : ${config.oauth.scopes.join(", ")}\n`);
    try {
      const tokenData = await runOAuthFlow(config, (url) => {
        console.log("Open this URL in your browser:\n");
        console.log(`  ${url}\n`);
        const { execSync } = require("child_process");
        try { execSync(`xdg-open "${url}"`, { stdio: "ignore" }); } catch { /* silent */ }
      }, port);
      appendAdminLog(`auth success member=${tokenData.member_id} name=${tokenData.name}`);
      console.log(`\nAuthenticated: ${tokenData.name || "LinkedIn member"}`);
      console.log(`Email        : ${tokenData.email || "N/A"}`);
      console.log(`Expires in   : ${Math.floor((tokenData.expires_in || 5184000) / 86400)} days`);
      console.log("\nToken saved. linkedin-mcp is ready.\n");
    } catch (err) {
      appendAdminLog(`auth error ${err.message}`);
      console.error(`\nAuth failed: ${err.message}\n`);
      process.exit(1);
    }
  });

// ── status ────────────────────────────────────────────────────────────────────

program
  .command("status")
  .description("Show current authentication status, credentials, and token details.")
  .option("--json", "Output raw JSON")
  .action((opts) => {
    const config  = loadConfig();
    const summary = tokenSummary(config);
    const secrets = getSecretsStatus();

    if (opts.json) {
      console.log(JSON.stringify({ token: summary, credentials: secrets }, null, 2));
      return;
    }

    console.log();
    console.log(`Admin env file : ${adminEnvFilePath()}`);
    console.log();

    // Credentials table
    const rows = secrets.map((s) => ({
      variable: s.name,
      status:   s.present ? "✓ set" : "✗ missing",
      masked:   s.masked,
      source:   s.source,
    }));
    _printStatusTable("linkedin-admin status", rows);

    // Token summary below table
    console.log();
    if (summary.valid) {
      console.log(`Token   : valid — ${summary.name} <${summary.email}> — ${summary.days_left} days left`);
      console.log(`Expires : ${summary.expires_at}`);
    } else if (summary.present) {
      console.log("Token   : present but EXPIRED — run 'linkedin-admin auth' or 'linkedin-admin token set <value>'");
    } else {
      console.log("Token   : absent — run 'linkedin-admin auth' or 'linkedin-admin token set <value>'");
    }
    console.log();
  });

// ── logout ────────────────────────────────────────────────────────────────────

program
  .command("logout")
  .description("Clear the stored LinkedIn access token.")
  .action(() => {
    const config = loadConfig();
    clearToken(config);
    appendAdminLog("logout: token cleared");
    console.log("\nToken cleared. Run 'linkedin-admin auth' to re-authenticate.\n");
  });

// ── logs ──────────────────────────────────────────────────────────────────────

program
  .command("logs")
  .description("Show recent admin log lines.")
  .option("--lines <n>", "Number of lines to show", "50")
  .action((opts) => {
    const limit = parseInt(opts.lines, 10) || 50;
    console.log(getLogsText(limit));
  });

// ── health ────────────────────────────────────────────────────────────────────

program
  .command("health")
  .description("Show HTTP endpoint URLs and health check info.")
  .action(() => {
    console.log(`\n${healthSummaryText()}\n`);
  });

// ── urls ──────────────────────────────────────────────────────────────────────

program
  .command("urls")
  .description("Show all public and fallback endpoint URLs.")
  .action(() => {
    console.log(`\n${urlsSummary()}\n`);
  });

// ── client-id ─────────────────────────────────────────────────────────────────

const clientIdCmd = program
  .command("client-id")
  .description("Manage LINKEDIN_CLIENT_ID in the admin env file.");

clientIdCmd
  .command("set <value>")
  .description("Set LINKEDIN_CLIENT_ID.")
  .action((value) => {
    setClientId(value);
    console.log("\nLINKEDIN_CLIENT_ID set successfully.\n");
  });

clientIdCmd
  .command("unset")
  .description("Clear LINKEDIN_CLIENT_ID from the admin env file.")
  .action(() => {
    unsetClientId();
    console.log("\nLINKEDIN_CLIENT_ID cleared.\n");
  });

// ── client-secret ─────────────────────────────────────────────────────────────

const clientSecretCmd = program
  .command("client-secret")
  .description("Manage LINKEDIN_CLIENT_SECRET in the admin env file.");

clientSecretCmd
  .command("set <value>")
  .description("Set LINKEDIN_CLIENT_SECRET.")
  .action((value) => {
    setClientSecret(value);
    console.log("\nLINKEDIN_CLIENT_SECRET set successfully.\n");
  });

clientSecretCmd
  .command("unset")
  .description("Clear LINKEDIN_CLIENT_SECRET from the admin env file.")
  .action(() => {
    unsetClientSecret();
    console.log("\nLINKEDIN_CLIENT_SECRET cleared.\n");
  });

// ── token ─────────────────────────────────────────────────────────────────────

const tokenCmd = program
  .command("token")
  .description("Manage the OAuth access token directly.");

tokenCmd
  .command("set <value>")
  .description("Set access token directly (bypasses OAuth flow, 60-day default expiry).")
  .action((value) => {
    setAccessToken(value);
    console.log("\nAccess token set successfully. linkedin-mcp is ready.\n");
  });

tokenCmd
  .command("unset")
  .description("Clear the stored access token (same as logout).")
  .action(() => {
    unsetAccessToken();
    console.log("\nAccess token cleared. Run 'linkedin-admin auth' to re-authenticate.\n");
  });

module.exports = { program };

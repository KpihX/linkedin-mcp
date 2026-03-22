#!/usr/bin/env node
/**
 * linkedin-mcp — Admin CLI (linkedin-admin).
 *
 * Commands:
 *   auth             Start OAuth 2.0 flow (opens browser, saves token)
 *   status [--json]  Show token + secrets status table
 *   logout           Clear stored token
 *   logs [--lines N] Tail the admin log
 *   health           Show HTTP endpoint URLs
 *   urls             Show all public URLs
 *   guide            Show admin capabilities
 */

"use strict";

const { Command } = require("commander");

const { loadConfig, resolveEnv, ENV_VARS } = require("../config");
const { tokenSummary, clearToken }         = require("../token");
const { runOAuthFlow }                     = require("./oauth");
const {
  adminHelpText,
  appendAdminLog,
  getLogsText,
  getSecretsStatus,
  healthSummaryText,
  statusSummaryText,
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
  const sep  = "─";
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

  rows.forEach((r) => {
    let row = vl;
    row += ` ${_pad(r.variable, cols[0].width)} ${vl}`;
    row += ` ${_pad(r.status,   cols[1].width)} ${vl}`;
    row += ` ${_pad(r.masked,   cols[2].width)} ${vl}`;
    row += ` ${_pad(r.source,   cols[3].width)} ${vl}`;
    console.log(row);
    if (rows.indexOf(r) < rows.length - 1) console.log(mid);
  });

  console.log(bot);
}

// ── CLI program ───────────────────────────────────────────────────────────────

const program = new Command();
program
  .name("linkedin-admin")
  .description("linkedin-mcp administration: auth, status, logout, logs")
  .version(PKG.version);

// ── auth ─────────────────────────────────────────────────────────────────────

program
  .command("auth")
  .description("Start LinkedIn OAuth 2.0 flow. Opens a browser for authorization.")
  .action(async () => {
    const config = loadConfig();
    if (!config.oauth.client_id || !config.oauth.client_secret) {
      console.error(
        "\nError: LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET are not set.\n" +
        "Steps:\n" +
        "  1. Create app at https://developer.linkedin.com\n" +
        "  2. Add products: 'Sign In with LinkedIn using OpenID Connect' + 'Share on LinkedIn'\n" +
        "  3. Set redirect URI: http://localhost:3000/callback\n" +
        "  4. Store credentials via bw-env: LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET\n",
      );
      process.exit(1);
    }
    console.log("\nStarting LinkedIn OAuth flow...");
    console.log(`Redirect URI : ${config.oauth.redirect_uri}`);
    console.log(`Scopes       : ${config.oauth.scopes.join(", ")}\n`);
    try {
      const tokenData = await runOAuthFlow(config, (url) => {
        console.log("Open this URL in your browser:\n");
        console.log(`  ${url}\n`);
        const { execSync } = require("child_process");
        try { execSync(`xdg-open "${url}"`, { stdio: "ignore" }); } catch { /* silent */ }
      });
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
  .description("Show current authentication status, token details, and secrets.")
  .option("--json", "Output raw JSON")
  .action((opts) => {
    const config  = loadConfig();
    const summary = tokenSummary(config);
    const secrets = getSecretsStatus();

    if (opts.json) {
      console.log(JSON.stringify({ token: summary, secrets }, null, 2));
      return;
    }

    // Token section
    console.log();
    console.log(`Local .env path: ${require("path").join(__dirname, "../.env")}`);
    console.log();

    // Secrets table
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
      console.log("Token   : present but EXPIRED — run 'linkedin-admin auth'");
    } else {
      console.log("Token   : absent — run 'linkedin-admin auth'");
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

// ── guide ─────────────────────────────────────────────────────────────────────

program
  .command("guide")
  .description("Show full admin capabilities (CLI + HTTP + Telegram).")
  .action(() => {
    console.log(`\n${adminHelpText()}\n`);
  });

module.exports = { program };

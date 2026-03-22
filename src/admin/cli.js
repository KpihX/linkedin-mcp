#!/usr/bin/env node
/**
 * linkedin-mcp — Admin CLI (linkedin-admin).
 *
 * Commands:
 *   auth             Start OAuth 2.0 flow (opens browser, saves token)
 *   status [--json]  Show token + member info
 *   logout           Clear stored token
 *   logs [--lines N] Tail the admin log
 *   health           Show HTTP endpoint URLs
 *   urls             Show all public URLs
 *   guide            Show admin capabilities
 */

"use strict";

const { Command } = require("commander");

const { loadConfig }       = require("../config");
const { tokenSummary, clearToken } = require("../token");
const { runOAuthFlow }     = require("./oauth");
const {
  adminHelpText,
  getLogsText,
  healthSummaryText,
  statusSummaryText,
  urlsSummary,
  appendAdminLog,
} = require("./service");

const PKG = require("../../package.json");

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
  .description("Show current authentication status and token details.")
  .option("--json", "Output raw JSON")
  .action((opts) => {
    const config  = loadConfig();
    const summary = tokenSummary(config);
    if (opts.json) {
      console.log(JSON.stringify(summary, null, 2));
    } else {
      console.log(`\n${statusSummaryText()}\n`);
    }
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

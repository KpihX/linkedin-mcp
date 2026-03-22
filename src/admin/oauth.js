/**
 * linkedin-mcp — OAuth 2.0 flow manager.
 *
 * Launches a local HTTP server on a configurable port (default 3000) to catch
 * the authorization code from LinkedIn, then exchanges it for an access token.
 *
 * Usage:
 *   const { runOAuthFlow } = require("./oauth");
 *   const tokenData = await runOAuthFlow(config, onUrl);
 *   // or with port override:
 *   const tokenData = await runOAuthFlow(config, onUrl, 8080);
 */

"use strict";

const http   = require("http");
const crypto = require("crypto");
const { saveToken } = require("../token");

const LI_AUTH_URL  = "https://www.linkedin.com/oauth/v2/authorization";
const LI_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";

/**
 * Build the LinkedIn OAuth authorization URL.
 */
function buildAuthUrl(config, state, redirectUri) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.oauth.client_id,
    redirect_uri: redirectUri,
    state,
    scope: config.oauth.scopes.join(" "),
  });
  return `${LI_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange an authorization code for an access token.
 */
async function exchangeCode(config, code, redirectUri) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: config.oauth.client_id,
    client_secret: config.oauth.client_secret,
  });
  const res = await fetch(LI_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Token exchange failed");
  }
  return data;
}

/**
 * Fetch profile info to enrich the stored token.
 */
async function fetchProfile(accessToken) {
  const res = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return {};
  return res.json();
}

/**
 * Run the full OAuth flow:
 *  1. Start local callback server on the given port
 *  2. Return the auth URL for the user to open
 *  3. Wait for callback with code
 *  4. Exchange code → token
 *  5. Fetch profile → enrich token
 *  6. Persist token to disk
 *
 * @param {object}   config
 * @param {function} onUrl        - Called with the auth URL string so caller can print/open it
 * @param {number}   [portOverride] - Override the callback port (default: config.oauth.redirect_port || 3000)
 * @returns {Promise<object>} tokenData
 */
function runOAuthFlow(config, onUrl, portOverride) {
  return new Promise((resolve, reject) => {
    if (!config.oauth.client_id || !config.oauth.client_secret) {
      return reject(new Error(
        "LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET must be set. " +
        "Register your app at https://developer.linkedin.com",
      ));
    }

    const port        = portOverride || config.oauth.redirect_port || 3000;
    const redirectUri = `http://localhost:${port}/callback`;
    const state       = crypto.randomBytes(16).toString("hex");
    const authUrl     = buildAuthUrl(config, state, redirectUri);

    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://localhost:${port}`);
      if (url.pathname !== "/callback") {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const error = url.searchParams.get("error");
      if (error) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(`<h2>OAuth Error: ${error}</h2><p>${url.searchParams.get("error_description") || ""}</p>`);
        server.close();
        return reject(new Error(`OAuth error: ${error}`));
      }

      const returnedState = url.searchParams.get("state");
      if (returnedState !== state) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end("<h2>Invalid state parameter — possible CSRF.</h2>");
        server.close();
        return reject(new Error("State mismatch"));
      }

      const code = url.searchParams.get("code");
      if (!code) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end("<h2>No authorization code received.</h2>");
        server.close();
        return reject(new Error("No code in callback"));
      }

      try {
        const tokenData = await exchangeCode(config, code, redirectUri);
        const profile   = await fetchProfile(tokenData.access_token);
        const enriched  = {
          ...tokenData,
          member_id: profile.sub   || null,
          name:      profile.name  || null,
          email:     profile.email || null,
        };
        saveToken(config, enriched);

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(
          `<h2>linkedin-mcp authenticated!</h2>` +
          `<p>Welcome, <strong>${enriched.name || "LinkedIn member"}</strong>.</p>` +
          `<p>Token saved. You can close this tab.</p>`,
        );
        server.close();
        resolve(enriched);
      } catch (err) {
        res.writeHead(500, { "Content-Type": "text/html" });
        res.end(`<h2>Token exchange failed</h2><p>${err.message}</p>`);
        server.close();
        reject(err);
      }
    });

    server.listen(port, "127.0.0.1", () => {
      if (onUrl) onUrl(authUrl);
    });

    server.on("error", (err) => {
      reject(new Error(`Could not start callback server on port ${port}: ${err.message}`));
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error("OAuth flow timed out (5 min). Please retry."));
    }, 300_000);
  });
}

module.exports = { runOAuthFlow, buildAuthUrl };

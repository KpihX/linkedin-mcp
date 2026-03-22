/**
 * Tests — src/config.js
 */

"use strict";

const { loadConfig, DEFAULTS } = require("../src/config");
const PKG = require("../package.json");

describe("loadConfig", () => {
  test("loads config.json and applies defaults", () => {
    const cfg = loadConfig();
    expect(cfg.server.name).toBe(PKG.name);
    expect(cfg.server.version).toBe(PKG.version);
    expect(cfg.server.http_port).toBe(8095);
    expect(cfg.server.http_mcp_path).toBe("/mcp");
    expect(cfg.logging.level).toBe("error");
  });

  test("config has all required top-level keys", () => {
    const cfg = loadConfig();
    expect(cfg.server).toBeDefined();
    expect(cfg.oauth).toBeDefined();
    expect(cfg.logging).toBeDefined();
  });

  test("oauth defaults include expected scopes", () => {
    const cfg = loadConfig();
    expect(cfg.oauth.scopes).toContain("openid");
    expect(cfg.oauth.scopes).toContain("profile");
    expect(cfg.oauth.scopes).toContain("email");
    expect(cfg.oauth.scopes).toContain("w_member_social");
  });

  test("env override: LINKEDIN_STATE_DIR", () => {
    process.env.LINKEDIN_STATE_DIR = "/tmp/li-test";
    const cfg = loadConfig();
    expect(cfg.server.state_directory).toBe("/tmp/li-test");
    delete process.env.LINKEDIN_STATE_DIR;
  });

  test("env override: LINKEDIN_MCP_HTTP_PORT", () => {
    process.env.LINKEDIN_MCP_HTTP_PORT = "9999";
    const cfg = loadConfig();
    expect(cfg.server.http_port).toBe(9999);
    delete process.env.LINKEDIN_MCP_HTTP_PORT;
  });

  test("env override: LINKEDIN_MCP_LOG_LEVEL", () => {
    process.env.LINKEDIN_MCP_LOG_LEVEL = "debug";
    const cfg = loadConfig();
    expect(cfg.logging.level).toBe("debug");
    delete process.env.LINKEDIN_MCP_LOG_LEVEL;
  });

  test("env: LINKEDIN_CLIENT_ID populates oauth", () => {
    process.env.LINKEDIN_CLIENT_ID = "test-client-id";
    const cfg = loadConfig();
    expect(cfg.oauth.client_id).toBe("test-client-id");
    delete process.env.LINKEDIN_CLIENT_ID;
  });

  test("DEFAULTS has expected structure", () => {
    expect(DEFAULTS.server.http_port).toBe(8095);
    expect(DEFAULTS.oauth.redirect_port).toBe(3001);
    expect(DEFAULTS.logging.level).toBe("error");
  });
});

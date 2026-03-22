/**
 * Tests — src/token.js
 */

"use strict";

const os   = require("os");
const path = require("path");
const fs   = require("fs");
const { saveToken, loadToken, clearToken, tokenSummary } = require("../src/token");

const TEST_DIR = path.join(os.tmpdir(), `linkedin-mcp-test-${Date.now()}`);
const testConfig = { server: { state_directory: TEST_DIR } };

afterEach(() => {
  // Clean up test state dir
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

describe("token storage", () => {
  test("saveToken + loadToken round-trip", () => {
    saveToken(testConfig, {
      access_token: "tok_abc",
      expires_in: 5184000,
      member_id: "sub123",
      name: "Test User",
      email: "test@example.com",
    });
    const loaded = loadToken(testConfig);
    expect(loaded).not.toBeNull();
    expect(loaded.access_token).toBe("tok_abc");
    expect(loaded.member_id).toBe("sub123");
    expect(loaded.name).toBe("Test User");
  });

  test("loadToken returns null when no file", () => {
    const result = loadToken(testConfig);
    expect(result).toBeNull();
  });

  test("loadToken returns null for expired token", () => {
    saveToken(testConfig, {
      access_token: "tok_old",
      expires_in: -1, // already expired
    });
    // Manually set expires_at in the past
    const tokenPath = path.join(TEST_DIR, "token.json");
    const data = JSON.parse(fs.readFileSync(tokenPath, "utf-8"));
    data.expires_at = Date.now() - 1000;
    fs.writeFileSync(tokenPath, JSON.stringify(data), "utf-8");

    const result = loadToken(testConfig);
    expect(result).toBeNull();
  });

  test("clearToken removes the file", () => {
    saveToken(testConfig, { access_token: "tok_x", expires_in: 5184000 });
    expect(loadToken(testConfig)).not.toBeNull();
    clearToken(testConfig);
    expect(loadToken(testConfig)).toBeNull();
  });

  test("tokenSummary: not present when no file", () => {
    const summary = tokenSummary(testConfig);
    expect(summary.present).toBe(false);
    expect(summary.valid).toBe(false);
  });

  test("tokenSummary: valid with fresh token", () => {
    saveToken(testConfig, {
      access_token: "tok_fresh",
      expires_in: 5184000,
      member_id: "sub999",
      name: "Fresh User",
      email: "fresh@example.com",
    });
    const summary = tokenSummary(testConfig);
    expect(summary.present).toBe(true);
    expect(summary.valid).toBe(true);
    expect(summary.expired).toBe(false);
    expect(summary.days_left).toBeGreaterThan(50);
    expect(summary.name).toBe("Fresh User");
    expect(summary.email).toBe("fresh@example.com");
  });

  test("tokenSummary: expired when token is past expiry", () => {
    saveToken(testConfig, { access_token: "tok_exp", expires_in: 5184000 });
    const tokenPath = path.join(TEST_DIR, "token.json");
    const data = JSON.parse(fs.readFileSync(tokenPath, "utf-8"));
    data.expires_at = Date.now() - 1000;
    fs.writeFileSync(tokenPath, JSON.stringify(data), "utf-8");
    const summary = tokenSummary(testConfig);
    expect(summary.present).toBe(true);
    expect(summary.valid).toBe(false);
    expect(summary.expired).toBe(true);
  });
});

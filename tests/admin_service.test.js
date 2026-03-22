/**
 * Tests — src/admin/service.js
 */

"use strict";

const os   = require("os");
const path = require("path");
const fs   = require("fs");

// Use a temp state dir so tests don't touch real state
const TEST_STATE_DIR = path.join(os.tmpdir(), `linkedin-mcp-svc-test-${Date.now()}`);

beforeAll(() => {
  process.env.LINKEDIN_STATE_DIR    = TEST_STATE_DIR;
  process.env.LINKEDIN_ADMIN_ENV_FILE = path.join(TEST_STATE_DIR, "linkedin-admin.env");
  fs.mkdirSync(TEST_STATE_DIR, { recursive: true });
});

afterAll(() => {
  delete process.env.LINKEDIN_STATE_DIR;
  delete process.env.LINKEDIN_ADMIN_ENV_FILE;
  fs.rmSync(TEST_STATE_DIR, { recursive: true, force: true });
});

const {
  adminEnvFilePath,
  adminHelpText,
  getSecretsStatus,
  healthSummaryText,
  setClientId,
  setClientSecret,
  setAccessToken,
  unsetClientId,
  unsetClientSecret,
  unsetAccessToken,
  statusSummaryText,
  urlsSummary,
} = require("../src/admin/service");

describe("admin service helpers", () => {
  test("adminHelpText includes CLI, HTTP, Telegram sections", () => {
    const text = adminHelpText();
    expect(text).toContain("CLI:");
    expect(text).toContain("HTTP:");
    expect(text).toContain("Telegram:");
    expect(text).toContain("linkedin-admin auth");
    expect(text).toContain("/health");
    expect(text).toContain("/status");
  });

  test("adminHelpText includes credential management commands", () => {
    const text = adminHelpText();
    expect(text).toContain("client-id set");
    expect(text).toContain("client-secret set");
    expect(text).toContain("token set");
    expect(text).toContain("/token_set");
    expect(text).toContain("/client_id_set");
  });

  test("healthSummaryText includes port and mcp path", () => {
    const text = healthSummaryText();
    expect(text).toContain("8095");
    expect(text).toContain("/mcp");
  });

  test("statusSummaryText includes service name", () => {
    const text = statusSummaryText();
    expect(text).toContain("linkedin-mcp");
    expect(text).toContain("Token:");
  });

  test("urlsSummary includes public URL", () => {
    const text = urlsSummary();
    expect(text).toContain("kpihx-labs.com");
    expect(text).toContain("/health");
    expect(text).toContain("/admin/status");
  });

  test("adminEnvFilePath returns a string", () => {
    expect(typeof adminEnvFilePath()).toBe("string");
  });
});

describe("getSecretsStatus", () => {
  test("returns array with expected credentials", () => {
    const rows = getSecretsStatus();
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const names = rows.map((r) => r.name);
    expect(names).toContain("LINKEDIN_CLIENT_ID");
    expect(names).toContain("LINKEDIN_CLIENT_SECRET");
    expect(names).toContain("OAuth Token");
    // Telegram token should NOT be in the credentials table
    expect(names).not.toContain("TELEGRAM_LINKEDIN_HOMELAB_TOKEN");
  });

  test("rows have required fields", () => {
    const rows = getSecretsStatus();
    for (const row of rows) {
      expect(typeof row.name).toBe("string");
      expect(typeof row.present).toBe("boolean");
      expect(typeof row.masked).toBe("string");
      expect(typeof row.source).toBe("string");
    }
  });
});

describe("credential management (setClientId / unsetClientId)", () => {
  afterEach(() => {
    delete process.env.LINKEDIN_CLIENT_ID;
  });

  test("setClientId writes to admin env file and sets process.env", () => {
    setClientId("test-client-id-123");
    expect(process.env.LINKEDIN_CLIENT_ID).toBe("test-client-id-123");
    const envFile = adminEnvFilePath();
    expect(fs.existsSync(envFile)).toBe(true);
    const content = fs.readFileSync(envFile, "utf-8");
    expect(content).toContain("LINKEDIN_CLIENT_ID=test-client-id-123");
  });

  test("unsetClientId removes from admin env file and process.env", () => {
    setClientId("to-be-removed");
    expect(process.env.LINKEDIN_CLIENT_ID).toBe("to-be-removed");
    unsetClientId();
    expect(process.env.LINKEDIN_CLIENT_ID).toBeUndefined();
    const envFile = adminEnvFilePath();
    if (fs.existsSync(envFile)) {
      const content = fs.readFileSync(envFile, "utf-8");
      expect(content).not.toContain("LINKEDIN_CLIENT_ID=");
    }
  });

  test("setClientId updates existing key without duplication", () => {
    setClientId("first-value");
    setClientId("second-value");
    const envFile = adminEnvFilePath();
    const content = fs.readFileSync(envFile, "utf-8");
    const matches = content.match(/^LINKEDIN_CLIENT_ID=/gm) || [];
    expect(matches.length).toBe(1);
    expect(content).toContain("LINKEDIN_CLIENT_ID=second-value");
  });
});

describe("credential management (setClientSecret / unsetClientSecret)", () => {
  afterEach(() => {
    delete process.env.LINKEDIN_CLIENT_SECRET;
  });

  test("setClientSecret writes to admin env file", () => {
    setClientSecret("test-secret-abc");
    expect(process.env.LINKEDIN_CLIENT_SECRET).toBe("test-secret-abc");
  });

  test("unsetClientSecret clears from env", () => {
    setClientSecret("to-clear");
    unsetClientSecret();
    expect(process.env.LINKEDIN_CLIENT_SECRET).toBeUndefined();
  });
});

describe("credential management (setAccessToken / unsetAccessToken)", () => {
  test("setAccessToken writes token.json", () => {
    setAccessToken("my-test-access-token");
    const tokenPath = require("path").join(TEST_STATE_DIR, "token.json");
    expect(fs.existsSync(tokenPath)).toBe(true);
    const data = JSON.parse(fs.readFileSync(tokenPath, "utf-8"));
    expect(data.access_token).toBe("my-test-access-token");
  });

  test("unsetAccessToken removes token.json", () => {
    setAccessToken("temp-token");
    unsetAccessToken();
    const tokenPath = require("path").join(TEST_STATE_DIR, "token.json");
    expect(fs.existsSync(tokenPath)).toBe(false);
  });
});

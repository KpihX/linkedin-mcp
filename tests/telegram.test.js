/**
 * Tests — src/admin/telegram.js (dispatch logic, no real API calls)
 */

"use strict";

const os   = require("os");
const path = require("path");
const fs   = require("fs");

// Use a temp state dir so tests don't touch real state
const TEST_STATE_DIR = path.join(os.tmpdir(), `linkedin-mcp-tg-test-${Date.now()}`);

beforeAll(() => {
  process.env.LINKEDIN_STATE_DIR      = TEST_STATE_DIR;
  process.env.LINKEDIN_ADMIN_ENV_FILE = path.join(TEST_STATE_DIR, "linkedin-admin.env");
  fs.mkdirSync(TEST_STATE_DIR, { recursive: true });
});

afterAll(() => {
  delete process.env.LINKEDIN_STATE_DIR;
  delete process.env.LINKEDIN_ADMIN_ENV_FILE;
  fs.rmSync(TEST_STATE_DIR, { recursive: true, force: true });
});

const { dispatchTelegramCommand, telegramAdminEnabled } = require("../src/admin/telegram");

describe("telegramAdminEnabled", () => {
  test("returns false when env vars are absent", () => {
    const orig1 = process.env.TELEGRAM_LINKEDIN_HOMELAB_TOKEN;
    const orig2 = process.env.TELEGRAM_CHAT_IDS;
    delete process.env.TELEGRAM_LINKEDIN_HOMELAB_TOKEN;
    delete process.env.TELEGRAM_CHAT_IDS;
    expect(telegramAdminEnabled()).toBe(false);
    if (orig1) process.env.TELEGRAM_LINKEDIN_HOMELAB_TOKEN = orig1;
    if (orig2) process.env.TELEGRAM_CHAT_IDS = orig2;
  });

  test("returns true when both env vars are set", () => {
    process.env.TELEGRAM_LINKEDIN_HOMELAB_TOKEN = "token123";
    process.env.TELEGRAM_CHAT_IDS               = "12345";
    expect(telegramAdminEnabled()).toBe(true);
    delete process.env.TELEGRAM_LINKEDIN_HOMELAB_TOKEN;
    delete process.env.TELEGRAM_CHAT_IDS;
  });
});

describe("dispatchTelegramCommand — read commands", () => {
  test("/help returns help text", async () => {
    const reply = await dispatchTelegramCommand("/help", []);
    expect(reply).toContain("linkedin-admin");
    expect(reply).toContain("CLI:");
  });

  test("/start returns help text", async () => {
    const reply = await dispatchTelegramCommand("/start", []);
    expect(reply).toContain("linkedin-admin");
  });

  test("/status returns status text", async () => {
    const reply = await dispatchTelegramCommand("/status", []);
    expect(reply).toContain("linkedin-mcp");
  });

  test("/health returns health text", async () => {
    const reply = await dispatchTelegramCommand("/health", []);
    expect(reply).toContain("8095");
  });

  test("/urls returns URL summary", async () => {
    const reply = await dispatchTelegramCommand("/urls", []);
    expect(reply).toContain("kpihx-labs.com");
  });

  test("/logs returns log text", async () => {
    const reply = await dispatchTelegramCommand("/logs", ["10"]);
    expect(typeof reply).toBe("string");
  });

  test("unknown command returns fallback", async () => {
    const reply = await dispatchTelegramCommand("/unknowncmd", []);
    expect(reply).toMatch(/Unknown command/i);
  });
});

describe("dispatchTelegramCommand — credential management", () => {
  afterEach(() => {
    delete process.env.LINKEDIN_CLIENT_ID;
    delete process.env.LINKEDIN_CLIENT_SECRET;
  });

  test("/client_id_set sets the client ID", async () => {
    const reply = await dispatchTelegramCommand("/client_id_set", ["my-client-id"]);
    expect(reply).toContain("set successfully");
    expect(process.env.LINKEDIN_CLIENT_ID).toBe("my-client-id");
  });

  test("/client_id_set without value returns usage", async () => {
    const reply = await dispatchTelegramCommand("/client_id_set", []);
    expect(reply).toContain("Usage:");
  });

  test("/client_id_unset clears the client ID", async () => {
    process.env.LINKEDIN_CLIENT_ID = "to-remove";
    const reply = await dispatchTelegramCommand("/client_id_unset", []);
    expect(reply).toContain("cleared");
    expect(process.env.LINKEDIN_CLIENT_ID).toBeUndefined();
  });

  test("/client_secret_set sets the client secret", async () => {
    const reply = await dispatchTelegramCommand("/client_secret_set", ["my-secret"]);
    expect(reply).toContain("set successfully");
    expect(process.env.LINKEDIN_CLIENT_SECRET).toBe("my-secret");
  });

  test("/client_secret_set without value returns usage", async () => {
    const reply = await dispatchTelegramCommand("/client_secret_set", []);
    expect(reply).toContain("Usage:");
  });

  test("/client_secret_unset clears the client secret", async () => {
    process.env.LINKEDIN_CLIENT_SECRET = "to-remove";
    const reply = await dispatchTelegramCommand("/client_secret_unset", []);
    expect(reply).toContain("cleared");
    expect(process.env.LINKEDIN_CLIENT_SECRET).toBeUndefined();
  });

  test("/token_set sets the access token", async () => {
    const reply = await dispatchTelegramCommand("/token_set", ["my-access-token"]);
    expect(reply).toContain("set successfully");
    const tokenPath = path.join(TEST_STATE_DIR, "token.json");
    expect(fs.existsSync(tokenPath)).toBe(true);
  });

  test("/token_set without value returns usage", async () => {
    const reply = await dispatchTelegramCommand("/token_set", []);
    expect(reply).toContain("Usage:");
  });

  test("/token_unset clears the access token", async () => {
    await dispatchTelegramCommand("/token_set", ["temp-token"]);
    const reply = await dispatchTelegramCommand("/token_unset", []);
    expect(reply).toContain("cleared");
    const tokenPath = path.join(TEST_STATE_DIR, "token.json");
    expect(fs.existsSync(tokenPath)).toBe(false);
  });
});

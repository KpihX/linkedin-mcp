/**
 * Tests — src/admin/telegram.js (dispatch logic, no real API calls)
 */

"use strict";

const { dispatchTelegramCommand, telegramAdminEnabled } = require("../src/admin/telegram");

describe("telegramAdminEnabled", () => {
  test("returns false when env vars are absent", () => {
    const orig1 = process.env.TELEGRAM_LINKEDIN_TOKEN;
    const orig2 = process.env.TELEGRAM_CHAT_IDS;
    delete process.env.TELEGRAM_LINKEDIN_TOKEN;
    delete process.env.TELEGRAM_CHAT_IDS;
    expect(telegramAdminEnabled()).toBe(false);
    if (orig1) process.env.TELEGRAM_LINKEDIN_TOKEN = orig1;
    if (orig2) process.env.TELEGRAM_CHAT_IDS = orig2;
  });

  test("returns true when both env vars are set", () => {
    process.env.TELEGRAM_LINKEDIN_TOKEN = "token123";
    process.env.TELEGRAM_CHAT_IDS       = "12345";
    expect(telegramAdminEnabled()).toBe(true);
    delete process.env.TELEGRAM_LINKEDIN_TOKEN;
    delete process.env.TELEGRAM_CHAT_IDS;
  });
});

describe("dispatchTelegramCommand", () => {
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

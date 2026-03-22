/**
 * Tests — src/admin/service.js
 */

"use strict";

const {
  adminHelpText,
  getSecretsStatus,
  healthSummaryText,
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

  test("getSecretsStatus returns array with expected secrets", () => {
    const rows = getSecretsStatus();
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const names = rows.map((r) => r.name);
    expect(names).toContain("LINKEDIN_CLIENT_ID");
    expect(names).toContain("LINKEDIN_CLIENT_SECRET");
    expect(names).toContain("TELEGRAM_LINKEDIN_HOMELAB_TOKEN");
  });

  test("getSecretsStatus rows have required fields", () => {
    const rows = getSecretsStatus();
    for (const row of rows) {
      expect(typeof row.name).toBe("string");
      expect(typeof row.present).toBe("boolean");
      expect(typeof row.masked).toBe("string");
      expect(typeof row.source).toBe("string");
    }
  });
});

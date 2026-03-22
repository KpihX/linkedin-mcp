/**
 * Tests — src/admin/service.js
 */

"use strict";

const {
  adminHelpText,
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
    expect(text).toContain("token");
  });

  test("urlsSummary includes public URL", () => {
    const text = urlsSummary();
    expect(text).toContain("kpihx-labs.com");
    expect(text).toContain("/health");
    expect(text).toContain("/admin/status");
  });
});

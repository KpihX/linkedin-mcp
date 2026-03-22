/**
 * Tests — Tool registry + tool handlers (mocked LinkedIn client).
 */

"use strict";

const os   = require("os");
const path = require("path");
const fs   = require("fs");
const { listTools, callTool, ALL_TOOLS } = require("../src/tools/registry");

// ── Mock config ───────────────────────────────────────────────────────────────

const TEST_DIR = path.join(os.tmpdir(), `linkedin-mcp-tools-test-${Date.now()}`);
const mockConfig = {
  server: {
    name: "linkedin-mcp",
    version: "0.1.0",
    state_directory: TEST_DIR,
    http_port: 8095,
    http_mcp_path: "/mcp",
    public_base_url: "https://linkedin.kpihx-labs.com",
    fallback_base_url: "https://linkedin.homelab",
  },
  oauth: {
    client_id: "test-id",
    client_secret: "test-secret",
    access_token: "mock_token",
    redirect_port: 3000,
    redirect_uri: "http://localhost:3000/callback",
    scopes: ["openid", "profile", "email", "w_member_social"],
  },
  logging: { level: "error" },
};

// Write a valid mock token so client.js can resolve member URN
beforeAll(() => {
  fs.mkdirSync(TEST_DIR, { recursive: true });
  const tokenPath = path.join(TEST_DIR, "token.json");
  fs.writeFileSync(tokenPath, JSON.stringify({
    access_token: "mock_token",
    expires_in: 5184000,
    expires_at: Date.now() + 5184000 * 1000,
    saved_at: Date.now(),
    member_id: "mock_sub_123",
    name: "Mock User",
    email: "mock@example.com",
  }), "utf-8");
});

afterAll(() => {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

const ctx = { config: mockConfig };

// ── Registry tests ────────────────────────────────────────────────────────────

describe("tool registry", () => {
  test("listTools returns an array", () => {
    const tools = listTools();
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBeGreaterThan(0);
  });

  test("all tool definitions have required fields", () => {
    for (const tool of listTools()) {
      expect(typeof tool.name).toBe("string");
      expect(tool.name.length).toBeGreaterThan(0);
      expect(typeof tool.description).toBe("string");
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe("object");
    }
  });

  test("no duplicate tool names", () => {
    const names = listTools().map((t) => t.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  test("ALL_TOOLS items have definition and handler", () => {
    for (const tool of ALL_TOOLS) {
      expect(tool.definition).toBeDefined();
      expect(typeof tool.handler).toBe("function");
    }
  });

  test("callTool returns error for unknown tool", async () => {
    const result = await callTool("nonexistent_tool", {}, ctx);
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toMatch(/Unknown tool/);
  });
});

// ── Guide tool ────────────────────────────────────────────────────────────────

describe("linkedin_guide", () => {
  test("returns orientation text", async () => {
    const result = await callTool("linkedin_guide", {}, ctx);
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("linkedin-mcp");
  });

  test("topic=posting filters to posting section", async () => {
    const result = await callTool("linkedin_guide", { topic: "posting" }, ctx);
    expect(result.content[0].text).toContain("linkedin_create_post");
  });

  test("topic=auth shows auth section", async () => {
    const result = await callTool("linkedin_guide", { topic: "auth" }, ctx);
    expect(result.content[0].text).toContain("linkedin-admin auth");
  });
});

// ── Auth status tool ──────────────────────────────────────────────────────────

describe("linkedin_auth_status", () => {
  test("returns JSON with token summary fields", async () => {
    const result = await callTool("linkedin_auth_status", {}, ctx);
    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data).toHaveProperty("present");
    expect(data).toHaveProperty("valid");
  });
});

// ── Post tools (mocked fetch) ─────────────────────────────────────────────────

describe("linkedin_create_post (mocked)", () => {
  const origFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({}),
      headers: new Headers({ "x-restli-id": "urn:li:ugcPost:123456" }),
    });
  });

  afterEach(() => {
    global.fetch = origFetch;
  });

  test("returns postUrn on success", async () => {
    const result = await callTool("linkedin_create_post", { text: "Hello LinkedIn!" }, ctx);
    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.ok).toBe(true);
  });
});

describe("linkedin_delete_post (mocked)", () => {
  const origFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: async () => ({}),
      headers: new Headers({}),
    });
  });

  afterEach(() => {
    global.fetch = origFetch;
  });

  test("returns ok on success", async () => {
    const result = await callTool("linkedin_delete_post", { post_urn: "urn:li:ugcPost:999" }, ctx);
    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.ok).toBe(true);
  });
});

// ── Social tools ──────────────────────────────────────────────────────────────

describe("linkedin_like_post (mocked)", () => {
  const origFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({}),
      headers: new Headers({ "x-restli-id": "urn:li:like:1" }),
    });
  });

  afterEach(() => {
    global.fetch = origFetch;
  });

  test("returns ok on success", async () => {
    const result = await callTool("linkedin_like_post", { post_urn: "urn:li:ugcPost:111" }, ctx);
    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.ok).toBe(true);
  });
});

describe("linkedin_create_comment (mocked)", () => {
  const origFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({}),
      headers: new Headers({ "x-restli-id": "urn:li:comment:555" }),
    });
  });

  afterEach(() => {
    global.fetch = origFetch;
  });

  test("returns ok on success", async () => {
    const result = await callTool("linkedin_create_comment", {
      post_urn: "urn:li:ugcPost:111",
      text: "Great post!",
    }, ctx);
    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.ok).toBe(true);
  });
});

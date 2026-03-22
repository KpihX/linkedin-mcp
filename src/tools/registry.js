/**
 * linkedin-mcp — Tool Registry.
 *
 * Collects all tool definitions from category modules and provides:
 *   - listTools()                    → array of MCP tool definitions
 *   - callTool(name, args, context)  → MCP CallTool result
 */

"use strict";

const guideTools   = require("./guide");
const profileTools = require("./profile");
const postsTools   = require("./posts");
const socialTools  = require("./social");

const ALL_TOOLS = [
  ...guideTools,
  ...profileTools,
  ...postsTools,
  ...socialTools,
];

// Build lookup maps
const _definitions = ALL_TOOLS.map((t) => t.definition);
const _handlers    = new Map();
for (const t of ALL_TOOLS) {
  if (_handlers.has(t.definition.name)) {
    throw new Error(`Duplicate tool name: ${t.definition.name}`);
  }
  _handlers.set(t.definition.name, t.handler);
}

function listTools() {
  return _definitions;
}

async function callTool(name, args, ctx) {
  const handler = _handlers.get(name);
  if (!handler) {
    return {
      content: [{ type: "text", text: JSON.stringify({ error: `Unknown tool: ${name}` }) }],
      isError: true,
    };
  }
  try {
    ctx.toolDefs = _definitions;
    return await handler(args || {}, ctx);
  } catch (err) {
    const errorMessage = err.data
      ? `${err.message} — ${JSON.stringify(err.data)}`
      : err.message || String(err);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: errorMessage,
            tool: name,
            ...(err.statusCode ? { status_code: err.statusCode } : {}),
          }),
        },
      ],
      isError: true,
    };
  }
}

module.exports = { listTools, callTool, ALL_TOOLS };

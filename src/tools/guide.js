/**
 * linkedin-mcp — Guide tool.
 * Intent-first entry point: tells the agent what the MCP can do.
 */

"use strict";

const GUIDE_TOOL = {
  definition: {
    name: "linkedin_guide",
    description:
      "Orientation guide for the LinkedIn MCP. Call this first to understand available capabilities, " +
      "auth state, and which tools to use for specific goals.",
    inputSchema: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description: "Optional topic to focus on: 'auth', 'posting', 'profile', 'social', 'all'",
        },
      },
    },
  },

  handler: async (args, ctx) => {
    const { tokenSummary } = require("../token");
    const summary = tokenSummary(ctx.config);
    const topic   = (args.topic || "all").toLowerCase();

    const authBlock = summary.valid
      ? `AUTH: Authenticated as ${summary.name || "unknown"} (${summary.email || ""}) — ${summary.days_left} days left`
      : summary.present
        ? `AUTH: Token present but EXPIRED — run: linkedin-admin auth`
        : `AUTH: Not authenticated — run: linkedin-admin auth`;

    const sections = {
      auth: [
        "--- AUTH ---",
        "linkedin_auth_status   Check token state, expiry, member info",
        "Run 'linkedin-admin auth' to start OAuth flow (opens browser)",
        "Run 'linkedin-admin logout' to clear token",
        "Tokens last 60 days. No automatic refresh for personal apps.",
      ],
      posting: [
        "--- POSTING ---",
        "linkedin_create_post         Publish a text post to your LinkedIn feed",
        "linkedin_create_image_post   Publish a post with an image (local path or URL)",
        "linkedin_delete_post         Delete one of your own posts by URN",
      ],
      profile: [
        "--- PROFILE ---",
        "linkedin_get_profile         Get your own LinkedIn profile (name, headline, email, picture)",
        "linkedin_auth_status         Check token + member info",
      ],
      social: [
        "--- SOCIAL ---",
        "linkedin_like_post           Like any LinkedIn post by URN",
        "linkedin_create_comment      Comment on any LinkedIn post by URN",
      ],
    };

    const selectedSections =
      topic === "all" ? Object.values(sections).flat() : sections[topic] || sections.all;

    const lines = [
      "=== linkedin-mcp v0.1.0 ===",
      authBlock,
      "",
      ...selectedSections,
      "",
      "SCOPES: openid, profile, email, w_member_social",
      "NOTE: Reading others' posts requires 'r_member_social' (LinkedIn partner approval).",
      "      All tools above work with a standard developer app.",
    ];

    return {
      content: [{ type: "text", text: lines.join("\n") }],
    };
  },
};

module.exports = [GUIDE_TOOL];

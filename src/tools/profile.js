/**
 * linkedin-mcp — Profile tools.
 *   - linkedin_get_profile
 *   - linkedin_auth_status
 */

"use strict";

const { LinkedInClient } = require("../client");
const { tokenSummary }   = require("../token");

const GET_PROFILE = {
  definition: {
    name: "linkedin_get_profile",
    description: "Get your own LinkedIn profile information: name, email, profile picture URL, and locale.",
    inputSchema: { type: "object", properties: {} },
  },
  handler: async (_args, ctx) => {
    const client  = new LinkedInClient(ctx.config);
    const profile = await client.getProfile();
    return {
      content: [{ type: "text", text: JSON.stringify(profile, null, 2) }],
    };
  },
};

const AUTH_STATUS = {
  definition: {
    name: "linkedin_auth_status",
    description:
      "Check the current LinkedIn authentication status: token validity, expiry date, member info.",
    inputSchema: { type: "object", properties: {} },
  },
  handler: async (_args, ctx) => {
    const summary = tokenSummary(ctx.config);
    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
    };
  },
};

module.exports = [GET_PROFILE, AUTH_STATUS];

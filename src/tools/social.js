/**
 * linkedin-mcp — Social action tools.
 *   - linkedin_like_post
 *   - linkedin_create_comment
 */

"use strict";

const { LinkedInClient } = require("../client");

const LIKE_POST = {
  definition: {
    name: "linkedin_like_post",
    description: "Like a LinkedIn post on your behalf.",
    inputSchema: {
      type: "object",
      required: ["post_urn"],
      properties: {
        post_urn: {
          type: "string",
          description: "Post URN, e.g. 'urn:li:ugcPost:7123456789' or 'urn:li:share:7123456789'",
        },
      },
    },
  },
  handler: async (args, ctx) => {
    const client = new LinkedInClient(ctx.config);
    await client.likePost(args.post_urn);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ ok: true, message: "Post liked.", postUrn: args.post_urn }),
        },
      ],
    };
  },
};

const CREATE_COMMENT = {
  definition: {
    name: "linkedin_create_comment",
    description: "Add a comment to a LinkedIn post.",
    inputSchema: {
      type: "object",
      required: ["post_urn", "text"],
      properties: {
        post_urn: {
          type: "string",
          description: "Post URN to comment on",
        },
        text: {
          type: "string",
          description: "Comment text",
        },
      },
    },
  },
  handler: async (args, ctx) => {
    const client = new LinkedInClient(ctx.config);
    const result = await client.commentOnPost(args.post_urn, args.text);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            ok: true,
            commentUrn: result.commentUrn,
            message: "Comment posted.",
          }),
        },
      ],
    };
  },
};

module.exports = [LIKE_POST, CREATE_COMMENT];

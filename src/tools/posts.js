/**
 * linkedin-mcp — Post tools.
 *   - linkedin_create_post
 *   - linkedin_create_image_post
 *   - linkedin_delete_post
 */

"use strict";

const { LinkedInClient } = require("../client");

const CREATE_POST = {
  definition: {
    name: "linkedin_create_post",
    description:
      "Publish a text post to your LinkedIn feed. Returns the post URN on success.",
    inputSchema: {
      type: "object",
      required: ["text"],
      properties: {
        text: {
          type: "string",
          description: "Post content (max ~3000 chars for optimal display)",
        },
        visibility: {
          type: "string",
          enum: ["PUBLIC", "CONNECTIONS"],
          description: "Audience. Defaults to PUBLIC.",
        },
      },
    },
  },
  handler: async (args, ctx) => {
    const client = new LinkedInClient(ctx.config);
    const result = await client.createPost(
      args.text,
      args.visibility || "PUBLIC",
    );
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            ok: true,
            postUrn: result.postUrn,
            message: "Post published successfully.",
          }),
        },
      ],
    };
  },
};

const CREATE_IMAGE_POST = {
  definition: {
    name: "linkedin_create_image_post",
    description:
      "Publish a LinkedIn post with an image. The image can be a local file path or a public URL.",
    inputSchema: {
      type: "object",
      required: ["text", "image"],
      properties: {
        text: {
          type: "string",
          description: "Post caption / text content",
        },
        image: {
          type: "string",
          description: "Local file path (e.g. /home/user/photo.jpg) or public image URL",
        },
        alt_text: {
          type: "string",
          description: "Accessibility alt text for the image",
        },
        visibility: {
          type: "string",
          enum: ["PUBLIC", "CONNECTIONS"],
          description: "Audience. Defaults to PUBLIC.",
        },
      },
    },
  },
  handler: async (args, ctx) => {
    const client = new LinkedInClient(ctx.config);
    const result = await client.createImagePost(
      args.text,
      args.image,
      args.alt_text || "",
      args.visibility || "PUBLIC",
    );
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            ok: true,
            postUrn: result.postUrn,
            assetUrn: result.assetUrn,
            message: "Image post published successfully.",
          }),
        },
      ],
    };
  },
};

const DELETE_POST = {
  definition: {
    name: "linkedin_delete_post",
    description:
      "Delete one of your own LinkedIn posts. Requires the post URN (returned by linkedin_create_post).",
    inputSchema: {
      type: "object",
      required: ["post_urn"],
      properties: {
        post_urn: {
          type: "string",
          description: "Post URN, e.g. 'urn:li:ugcPost:7123456789'",
        },
      },
    },
  },
  handler: async (args, ctx) => {
    const client = new LinkedInClient(ctx.config);
    await client.deletePost(args.post_urn);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ ok: true, message: "Post deleted.", postUrn: args.post_urn }),
        },
      ],
    };
  },
};

module.exports = [CREATE_POST, CREATE_IMAGE_POST, DELETE_POST];

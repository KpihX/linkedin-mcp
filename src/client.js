/**
 * linkedin-mcp — LinkedIn API client.
 *
 * Wraps the LinkedIn v2 REST API with the access token loaded from:
 *   1. config.oauth.access_token (env: LINKEDIN_ACCESS_TOKEN)
 *   2. persisted token file (~/.mcps/linkedin/token.json)
 *
 * API surface used (no Partner Program required):
 *   GET  /v2/userinfo                          — own profile (OIDC)
 *   POST /v2/ugcPosts                          — create text/image post
 *   DELETE /v2/ugcPosts/{encodedUrn}           — delete own post
 *   POST /v2/socialActions/{postUrn}/comments  — comment on a post
 *   POST /v2/socialActions/{postUrn}/likes     — like a post
 *   POST /v2/assets?action=registerUpload      — register image upload
 *   PUT  {uploadUrl}                           — upload image binary
 */

"use strict";

const fs = require("fs");
const { loadToken } = require("./token");

const LI_API_BASE = "https://api.linkedin.com";
const LI_VERSION  = "202501"; // YYYYMM versioned header

class LinkedInClient {
  /**
   * @param {object} config  - merged config from loadConfig()
   */
  constructor(config) {
    this._config = config;
    this._token  = null;
  }

  // ── Token resolution ────────────────────────────────────────────────────────

  _resolveToken() {
    if (this._token) return this._token;
    // 1. env var
    if (this._config.oauth.access_token) {
      this._token = this._config.oauth.access_token;
      return this._token;
    }
    // 2. persisted file
    const stored = loadToken(this._config);
    if (stored && stored.access_token) {
      this._token = stored.access_token;
      return this._token;
    }
    return null;
  }

  _requireToken() {
    const t = this._resolveToken();
    if (!t) {
      throw Object.assign(
        new Error("Not authenticated. Run: linkedin-admin auth"),
        { statusCode: 401 },
      );
    }
    return t;
  }

  // ── Low-level HTTP helpers ──────────────────────────────────────────────────

  _headers(extra = {}) {
    return {
      Authorization: `Bearer ${this._requireToken()}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
      "LinkedIn-Version": LI_VERSION,
      ...extra,
    };
  }

  async _get(endpoint) {
    const res = await fetch(`${LI_API_BASE}${endpoint}`, {
      headers: this._headers(),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = body.message || body.error || `HTTP ${res.status}`;
      throw Object.assign(new Error(msg), { statusCode: res.status, data: body });
    }
    return body;
  }

  async _post(endpoint, payload) {
    const res = await fetch(`${LI_API_BASE}${endpoint}`, {
      method: "POST",
      headers: this._headers(),
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = body.message || body.error || `HTTP ${res.status}`;
      throw Object.assign(new Error(msg), { statusCode: res.status, data: body });
    }
    return { body, headers: Object.fromEntries(res.headers.entries()) };
  }

  async _delete(endpoint) {
    const res = await fetch(`${LI_API_BASE}${endpoint}`, {
      method: "DELETE",
      headers: this._headers(),
    });
    if (!res.ok && res.status !== 204) {
      const body = await res.json().catch(() => ({}));
      const msg  = body.message || body.error || `HTTP ${res.status}`;
      throw Object.assign(new Error(msg), { statusCode: res.status, data: body });
    }
  }

  // ── Profile ─────────────────────────────────────────────────────────────────

  /**
   * Get own profile via OIDC userinfo endpoint.
   * Returns: { sub, name, given_name, family_name, picture, email, locale }
   */
  async getProfile() {
    const res = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${this._requireToken()}` },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = body.message || `HTTP ${res.status}`;
      throw Object.assign(new Error(msg), { statusCode: res.status });
    }
    return body;
  }

  _memberUrn() {
    const stored = loadToken(this._config);
    if (stored && stored.member_id) return `urn:li:person:${stored.member_id}`;
    throw new Error(
      "Member ID not found in token. Re-run: linkedin-admin auth",
    );
  }

  // ── Posts ───────────────────────────────────────────────────────────────────

  /**
   * Create a text-only post.
   * @param {string} text        - Post content
   * @param {"PUBLIC"|"CONNECTIONS"} visibility
   * @returns {{ postUrn: string }}
   */
  async createPost(text, visibility = "PUBLIC") {
    const author = this._memberUrn();
    const payload = {
      author,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text },
          shareMediaCategory: "NONE",
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": visibility,
      },
    };
    const { headers } = await this._post("/v2/ugcPosts", payload);
    const postUrn = headers["x-restli-id"] || headers["X-RestLi-Id"] || null;
    return { postUrn };
  }

  /**
   * Create a post with a single image.
   * @param {string} text
   * @param {string} imagePath   - Local file path or URL
   * @param {string} altText
   * @param {"PUBLIC"|"CONNECTIONS"} visibility
   */
  async createImagePost(text, imagePath, altText = "", visibility = "PUBLIC") {
    const author = this._memberUrn();

    // Step 1: Register upload
    const { body: regBody } = await this._post(
      "/v2/assets?action=registerUpload",
      {
        registerUploadRequest: {
          recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
          owner: author,
          serviceRelationships: [
            { relationshipType: "OWNER", identifier: "urn:li:userGeneratedContent" },
          ],
        },
      },
    );
    const uploadUrl  = regBody.value.uploadMechanism["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"].uploadUrl;
    const assetUrn   = regBody.value.asset;

    // Step 2: Upload binary
    let imageBuffer;
    if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
      const r = await fetch(imagePath);
      imageBuffer = Buffer.from(await r.arrayBuffer());
    } else {
      imageBuffer = fs.readFileSync(imagePath);
    }
    await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${this._requireToken()}`,
        "Content-Type": "application/octet-stream",
      },
      body: imageBuffer,
    });

    // Step 3: Create post referencing the asset
    const payload = {
      author,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text },
          shareMediaCategory: "IMAGE",
          media: [
            {
              status: "READY",
              description: { text: altText },
              media: assetUrn,
              title: { text: altText || "Image" },
            },
          ],
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": visibility,
      },
    };
    const { headers } = await this._post("/v2/ugcPosts", payload);
    const postUrn = headers["x-restli-id"] || null;
    return { postUrn, assetUrn };
  }

  /**
   * Delete an own post by URN.
   * @param {string} postUrn  e.g. "urn:li:ugcPost:12345"
   */
  async deletePost(postUrn) {
    const encoded = encodeURIComponent(postUrn);
    await this._delete(`/v2/ugcPosts/${encoded}`);
  }

  // ── Social actions ──────────────────────────────────────────────────────────

  /**
   * Like a post.
   * @param {string} postUrn
   */
  async likePost(postUrn) {
    const author  = this._memberUrn();
    const encoded = encodeURIComponent(postUrn);
    await this._post(`/v2/socialActions/${encoded}/likes`, { actor: author });
  }

  /**
   * Comment on a post.
   * @param {string} postUrn
   * @param {string} text
   */
  async commentOnPost(postUrn, text) {
    const author  = this._memberUrn();
    const encoded = encodeURIComponent(postUrn);
    const { headers } = await this._post(
      `/v2/socialActions/${encoded}/comments`,
      {
        actor: author,
        message: { text },
      },
    );
    const commentUrn = headers["x-restli-id"] || null;
    return { commentUrn };
  }
}

module.exports = { LinkedInClient };

# linkedin-mcp

> **0 Trust · 100% Control | 0 Magic · 100% Transparency | 0 Hardcoding · 100% Flexibility**

A **Model Context Protocol (MCP) server** for LinkedIn — official OAuth 2.0, intent-first tool surface, three-level admin (CLI · HTTP · Telegram). Designed for the KpihX homelab stack; deployment-ready with Docker + Traefik.

**Repos:** [GitHub](https://github.com/KpihX/linkedin-mcp) · [GitLab](https://gitlab.com/kpihx-labs/linkedin-mcp)

---

## Why this exists

LinkedIn has no general-purpose developer API for personal accounts. The official OAuth surface (`openid profile email w_member_social`) covers everything an individual power-user needs:

- Post, delete, like, comment on content
- Read own profile and auth status
- Guide agents through the flow with `linkedin_guide`

This MCP wraps that surface with **full operational visibility**: a CLI admin, an HTTP admin API, and an optional Telegram bot — the same architecture as `whats-mcp`, `tick-mcp`, `mail-mcp`.

---

## Architecture

```
linkedin-mcp/
├── src/
│   ├── main.js          ← entry: serve (stdio) | serve-http
│   ├── admin.js         ← entry: CLI admin (linkedin-admin)
│   ├── config.js        ← loadConfig() — deep merge defaults → config.json → env
│   ├── token.js         ← save / load / clear / summary  (~/.mcps/linkedin/token.json)
│   ├── client.js        ← LinkedInClient — official REST API calls
│   ├── server.js        ← createMcpServer() — MCP SDK wiring
│   ├── http_app.js      ← Express HTTP app: /health /admin/* /mcp
│   ├── .env.example     ← required secrets template
│   └── admin/
│       ├── cli.js       ← Commander CLI (auth / status / logout / logs / health / urls / guide)
│       ├── service.js   ← shared text helpers (statusSummaryText, healthSummaryText, …)
│       ├── oauth.js     ← LinkedIn OAuth 2.0 + OIDC flow
│       └── telegram.js  ← optional Telegram bot admin
├── tools/
│   ├── registry.js      ← listTools() + callTool()
│   ├── guide.js         ← linkedin_guide
│   ├── profile.js       ← linkedin_get_profile, linkedin_auth_status
│   ├── posts.js         ← linkedin_create_post, linkedin_create_image_post, linkedin_delete_post
│   └── social.js        ← linkedin_like_post, linkedin_create_comment
├── tests/               ← bun test (41 tests, 0 deps on live API)
├── deploy/
│   ├── docker-compose.yml
│   └── docker-compose.override.example.yml
├── Dockerfile
├── .gitlab-ci.yml
└── config.json          ← non-secret defaults (port 8095, state dir, scopes)
```

**Transport strategy:**

```
Agent / Claude / Gemini
         │
         ├─── HTTP (homelab) ──→  https://linkedin.kpihx-labs.com/mcp   (primary)
         └─── stdio (local)  ──→  ~/.bun/bin/linkedin-mcp serve         (fallback)
```

---

## Tools (8)

| Tool | Description |
|------|-------------|
| `linkedin_guide` | Orientation — all tools, auth flow, quick start |
| `linkedin_auth_status` | Token presence, validity, days remaining, profile |
| `linkedin_get_profile` | Fetch own LinkedIn profile (name, email, sub) |
| `linkedin_create_post` | Create a text post (PUBLIC or CONNECTIONS) |
| `linkedin_create_image_post` | Create a post with an attached image |
| `linkedin_delete_post` | Delete a post by URN |
| `linkedin_like_post` | Like a post by URN |
| `linkedin_create_comment` | Add a comment to a post by URN |

---

## Admin interfaces

### CLI (`linkedin-admin`)

```bash
linkedin-admin auth          # Run OAuth flow — opens browser, saves token
linkedin-admin status        # Token status + profile
linkedin-admin status --json # Machine-readable JSON
linkedin-admin logout        # Clear saved token
linkedin-admin logs --lines 50
linkedin-admin health        # HTTP server reachability
linkedin-admin urls          # All public/private endpoints
linkedin-admin guide         # Full help text
```

### HTTP admin

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Liveness probe |
| `GET /admin/status` | Token status + Telegram runtime state |
| `GET /admin/help` | All commands reference |
| `GET /admin/logs?lines=50` | Recent admin log tail |
| `POST /mcp` | MCP Streamable HTTP transport |

### Telegram bot (optional)

Set `TELEGRAM_LINKEDIN_TOKEN` + `TELEGRAM_CHAT_IDS` and the server polls every 5 s.

| Command | Action |
|---------|--------|
| `/start` `/help` | Full command reference |
| `/status` | Token + service status |
| `/health` | HTTP server health |
| `/urls` | Endpoint map |
| `/logs [n]` | Last n admin log lines (default 20) |

---

## Quick start

### 1. LinkedIn App setup

1. Go to [LinkedIn Developer Portal](https://developer.linkedin.com)
2. Create an app → add products: **"Sign In with LinkedIn using OpenID Connect"** + **"Share on LinkedIn"**
3. Set redirect URI: `http://localhost:3000/callback`
4. Note `Client ID` and `Client Secret`

### 2. Configure secrets

```bash
cp src/.env.example .env
# Fill in LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET
```

### 3. Install & authenticate

```bash
bun install
bun link              # editable install: ~/.bun/bin/linkedin-mcp + linkedin-admin

linkedin-admin auth   # opens browser → authorizes → saves token
linkedin-admin status # verify token is valid
```

### 4. Start MCP server

```bash
# stdio (for agent config)
linkedin-mcp serve

# HTTP (for homelab deployment)
linkedin-mcp serve-http
```

---

## Docker / Homelab deployment

```bash
cp deploy/docker-compose.yml docker-compose.yml
cp deploy/docker-compose.override.example.yml docker-compose.override.yml
# Edit docker-compose.override.yml with your secrets

docker compose up -d
```

Traefik labels in `deploy/docker-compose.yml` expose:
- `https://linkedin.kpihx-labs.com` (primary private trusted route)
- `https://linkedin.homelab` (fallback)

---

## Agent registration

### Claude Code (`~/.claude.json`)

```json
"linkedin-mcp": {
  "type": "http",
  "url": "https://linkedin.kpihx-labs.com/mcp"
},
"linkedin-mcp--fallback": {
  "command": "/home/kpihx/.bun/bin/linkedin-mcp",
  "args": ["serve"]
}
```

### Gemini (`~/.gemini/extensions/linkedin_mcp/gemini-extension.json`)

```json
{
  "name": "linkedin-mcp",
  "version": "0.1.0",
  "mcpServers": {
    "linkedin-mcp": {
      "httpUrl": "https://linkedin.kpihx-labs.com/mcp"
    },
    "linkedin-mcp--fallback": {
      "command": "/home/kpihx/.bun/bin/linkedin-mcp",
      "args": ["serve"]
    }
  }
}
```

---

## Tests

```bash
bun test           # 41 tests, 5 files, 0 live API calls
bun test --watch   # watch mode
```

All tests use mocked `fetch` and temp directories — no credentials needed.

---

## Token lifecycle

LinkedIn personal OAuth tokens expire in **60 days**. There is no refresh token for non-Partner apps.

```
Day 0   →  linkedin-admin auth   (OAuth flow, browser consent)
Day 55+ →  linkedin-admin status  (shows days_left, warns if < 7)
Day 60  →  token invalid, re-run auth
```

---

## License

MIT — see [LICENSE](LICENSE).

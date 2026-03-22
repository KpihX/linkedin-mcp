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
│       ├── cli.js       ← Commander CLI (auth / status / logout / logs / health / urls
│       │                               / client-id / client-secret / token)
│       ├── service.js   ← unified admin kernel — single source of truth for all surfaces
│       ├── oauth.js     ← LinkedIn OAuth 2.0 + OIDC flow (configurable callback port)
│       └── telegram.js  ← optional Telegram bot admin (15 commands)
├── tools/
│   ├── registry.js      ← listTools() + callTool()
│   ├── guide.js         ← linkedin_guide
│   ├── profile.js       ← linkedin_get_profile, linkedin_auth_status
│   ├── posts.js         ← linkedin_create_post, linkedin_create_image_post, linkedin_delete_post
│   └── social.js        ← linkedin_like_post, linkedin_create_comment
├── tests/               ← bun test (61 tests, 0 deps on live API)
├── deploy/
│   ├── docker-compose.yml
│   └── docker-compose.override.example.yml
├── Dockerfile
├── .gitlab-ci.yml
└── config.json          ← non-secret defaults (port 8095, OAuth port 3001, state dir, scopes)
```

**Transport strategy:**

```
Agent / Claude / Gemini / Codex / Copilot / Vibe
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
# Authentication
linkedin-admin auth [--port N]     # OAuth flow — opens browser, saves token (default port 3001)
linkedin-admin token set <value>   # Set access token directly (fetches profile, no browser)
linkedin-admin token unset         # Clear stored token (same as logout)
linkedin-admin logout              # Clear stored token

# Credential management (stored in admin env file)
linkedin-admin client-id set <v>   # Set LINKEDIN_CLIENT_ID
linkedin-admin client-id unset     # Clear LINKEDIN_CLIENT_ID
linkedin-admin client-secret set <v>
linkedin-admin client-secret unset

# Status & observability
linkedin-admin status              # Credentials table + token summary
linkedin-admin status --json       # Machine-readable JSON
linkedin-admin logs [--lines 50]   # Tail admin log
linkedin-admin health              # HTTP server reachability
linkedin-admin urls                # All public/private endpoints
```

### HTTP admin

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Liveness probe |
| `/admin/status` | GET | Full runtime status (token + Telegram state) |
| `/admin/help` | GET | All commands reference |
| `/admin/logs?lines=50` | GET | Recent admin log tail |
| `/admin/client-id/set` | POST | Body: `{ "value": "..." }` |
| `/admin/client-id/unset` | POST | Clear LINKEDIN_CLIENT_ID |
| `/admin/client-secret/set` | POST | Body: `{ "value": "..." }` |
| `/admin/client-secret/unset` | POST | Clear LINKEDIN_CLIENT_SECRET |
| `/admin/token/set` | POST | Body: `{ "value": "..." }` — sets token + fetches profile |
| `/admin/token/unset` | POST | Clear stored token |
| `/mcp` | POST/GET/DELETE | MCP Streamable HTTP transport |

### Telegram bot (optional)

Set `TELEGRAM_LINKEDIN_HOMELAB_TOKEN` + `TELEGRAM_CHAT_IDS` — server polls every 5 s.

| Command | Action |
|---------|--------|
| `/start` `/help` | Full command reference |
| `/status` | Credentials + token status |
| `/health` | HTTP server health |
| `/urls` | Endpoint map |
| `/logs [n]` | Last n admin log lines (default 20) |
| `/token_set <value>` | Set access token (fetches profile) |
| `/token_unset` | Clear stored token |
| `/client_id_set <value>` | Set LINKEDIN_CLIENT_ID |
| `/client_id_unset` | Clear LINKEDIN_CLIENT_ID |
| `/client_secret_set <value>` | Set LINKEDIN_CLIENT_SECRET |
| `/client_secret_unset` | Clear LINKEDIN_CLIENT_SECRET |

---

## Quick start

### 1. LinkedIn App setup

1. Go to [LinkedIn Developer Portal](https://developer.linkedin.com)
2. Create an app → add products: **"Sign In with LinkedIn using OpenID Connect"** + **"Share on LinkedIn"**
3. Set redirect URI: `http://localhost:3001/callback`
4. Note `Client ID` and `Client Secret`

### 2. Configure secrets

```bash
# Option A — via admin CLI (written to admin env file)
linkedin-admin client-id set <your_client_id>
linkedin-admin client-secret set <your_client_secret>

# Option B — via .env file
cp src/.env.example src/.env
# Fill in LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET

# Option C — via bw-env / kshrc (injected at login shell)
```

### 3. Install & authenticate

```bash
bun install
bun link              # editable install: ~/.bun/bin/linkedin-mcp + linkedin-admin

# Full OAuth flow (browser consent)
linkedin-admin auth   # default port 3001
linkedin-admin auth --port 3002  # if 3001 is busy

# Or set access token directly (server/headless contexts)
linkedin-admin token set <your_access_token>

linkedin-admin status # verify credentials and token
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
cd deploy
cp docker-compose.override.example.yml docker-compose.override.yml
# Edit override with your secrets (or rely on CI env injection)

docker compose up -d
```

Traefik labels in `deploy/docker-compose.yml` expose:
- `https://linkedin.kpihx-labs.com` (primary private trusted route)
- `https://linkedin.homelab` (fallback)

The container persists all state in `/data` (Docker volume):
- `/data/state/token.json` — OAuth token
- `/data/linkedin-admin.env` — credentials written by `token set` / `client-id set`

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
  "version": "0.2.1",
  "mcpServers": {
    "linkedin-mcp": { "httpUrl": "https://linkedin.kpihx-labs.com/mcp" },
    "linkedin-mcp--fallback": {
      "command": "/home/kpihx/.bun/bin/linkedin-mcp",
      "args": ["serve"]
    }
  }
}
```

### Codex (`~/.codex/config.toml`)

```toml
[mcp_servers.linkedin_mcp]
url = "https://linkedin.kpihx-labs.com/mcp"

[mcp_servers.linkedin_mcp_fallback]
command = "/home/kpihx/.bun/bin/linkedin-mcp"
args = ["serve"]
```

### Copilot (`~/.copilot/mcp-config.json`)

```json
"linkedin_mcp": { "type": "http", "url": "https://linkedin.kpihx-labs.com/mcp" },
"linkedin_mcp_fallback": {
  "type": "stdio",
  "command": "/home/kpihx/.bun/bin/linkedin-mcp",
  "args": ["serve"]
}
```

### Vibe (`~/.vibe/config.toml`)

```toml
[[mcp_servers]]
name = "linkedin"
transport = "http"
url = "https://linkedin.kpihx-labs.com/mcp"

[[mcp_servers]]
name = "linkedin_fallback"
transport = "stdio"
command = "/home/kpihx/.bun/bin/linkedin-mcp"
args = ["serve"]
```

---

## Tests

```bash
bun test           # 61 tests, 5 files, 0 live API calls
bun test --watch   # watch mode
```

All tests use mocked `fetch` and temp directories — no credentials needed.

---

## Token lifecycle

LinkedIn personal OAuth tokens expire in **60 days**. There is no refresh token for non-Partner apps.

```
Day 0   →  linkedin-admin auth          (OAuth flow, browser consent)
           OR  linkedin-admin token set  (direct token, headless/server)
Day 55+ →  linkedin-admin status        (shows days_left)
Day 60  →  token invalid, re-run auth
```

Both flows produce a complete `token.json` with `member_id` populated — required for all posting tools.

---

## License

MIT — see [LICENSE](LICENSE).

# Changelog — linkedin-mcp

---

## [0.2.1] — 2026-03-22

### Fixed
- [x] `setAccessToken` now async with best-effort `GET /v2/userinfo` — populates `member_id`, `name`, `email` in token.json (required for posting tools that call `_memberUrn()`)
- [x] Status CLI display: `State dir` instead of `Admin env file` path
- [x] Redirect URI dynamically computed from port override in `runOAuthFlow` (was using hardcoded `config.oauth.redirect_uri`)

### Added
- [x] linkedin-mcp registered in Codex (`~/.codex/config.toml`), Copilot (`~/.copilot/mcp-config.json`), Vibe (`~/.vibe/config.toml`) — HTTP primary + stdio fallback

---

## [0.2.0] — 2026-03-22

### Added
- [x] Unified credential management — CLI, HTTP, Telegram: `client-id set/unset`, `client-secret set/unset`, `token set/unset`
- [x] Admin env file pattern (`LINKEDIN_ADMIN_ENV_FILE`, default `/data/linkedin-admin.env`) — persists credentials across restarts
- [x] `auth --port N` option to avoid `EADDRINUSE` (default port moved to 3001 via `config.json`)
- [x] OAuth callback port externalized to `config.json` (DEFAULTS remain 3000 as last-resort fallback only)
- [x] New HTTP POST routes: `/admin/{client-id,client-secret,token}/{set,unset}`
- [x] New Telegram commands: `/token_set`, `/token_unset`, `/client_id_set`, `/client_id_unset`, `/client_secret_set`, `/client_secret_unset`
- [x] Status table: shows `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `OAuth Token` — Telegram token removed
- [x] 61 tests (18 new) — all pass

### Fixed
- [x] `TELEGRAM_LINKEDIN_TOKEN` → `TELEGRAM_LINKEDIN_HOMELAB_TOKEN` reference in HTTP status handler

---

## [0.1.0] — 2026-03-22

### Added
- [x] Full MCP server — 8 tools: guide, auth_status, get_profile, create_post, create_image_post, delete_post, like_post, create_comment
- [x] LinkedIn OAuth 2.0 + OIDC flow (`linkedin-admin auth`)
- [x] Three-level admin: CLI (`linkedin-admin`) · HTTP (`/admin/*`) · Telegram bot
- [x] Dual transport: stdio + Streamable HTTP (Express, port 8095)
- [x] Token lifecycle management — 60-day expiry tracking, `tokenSummary` with days_left
- [x] Test suite — 41 tests, 5 files, 0 live API calls (mocked fetch + temp dirs)
- [x] Docker image (`oven/bun:1-slim`) + `deploy/docker-compose.yml` with Traefik labels
- [x] GitLab CI — test → deploy pipeline (homelab runner, no SSH)
- [x] Editable install via `bun link`

# linkedin-mcp — TODO

## v0.1.0 — Initial release
- [x] Project scaffold (Bun, CommonJS, package.json, config.json)
- [x] `src/config.js` — loadConfig with deep merge + env overrides
- [x] `src/token.js` — save / load / clear / tokenSummary
- [x] `src/client.js` — LinkedInClient (profile, post, image post, delete, like, comment)
- [x] `src/tools/` — 8 tools: guide, auth_status, get_profile, create_post, create_image_post, delete_post, like_post, create_comment
- [x] `src/tools/registry.js` — listTools + callTool
- [x] `src/server.js` — createMcpServer (ListTools + CallTool)
- [x] `src/main.js` — serve (stdio) + serve-http
- [x] `src/admin/oauth.js` — LinkedIn OAuth 2.0 + OIDC flow
- [x] `src/admin/service.js` — unified admin kernel (single source of truth)
- [x] `src/admin/telegram.js` — optional Telegram bot (poll every 5s)
- [x] `src/admin/cli.js` — Commander CLI
- [x] `src/admin.js` — CLI entry point
- [x] `src/http_app.js` — Express HTTP app (/health /admin/* /mcp)
- [x] `Dockerfile` + `deploy/docker-compose.yml`
- [x] `.gitlab-ci.yml` (test + deploy, homelab runner, no SSH)
- [x] Test suite — 41 tests across 5 files (0 live API calls)
- [x] `README.md`, `TODO.md`, `CHANGELOG.md`
- [x] `bun link` (editable install)
- [x] Claude Code registration (`linkedin-mcp` HTTP + `linkedin-mcp--fallback` stdio)
- [x] Gemini extension (`~/Work/AI/gemini_mcps/linkedin_mcp/`)
- [x] GitHub repo created (`KpihX/linkedin-mcp`) + pushed
- [x] GitLab repo created (`kpihx-labs/linkedin-mcp`) + pushed
- [x] Published to npm as `k-linkedin-mcp@0.1.0`
- [x] AGENT.md + CLAUDE.md MCP tables updated

## v0.2.0 — Unified credential management
- [x] Unified admin kernel: service.js = single source of truth for CLI/HTTP/Telegram
- [x] `client-id set/unset`, `client-secret set/unset`, `token set/unset` (CLI + HTTP POST + Telegram)
- [x] Admin env file pattern (`LINKEDIN_ADMIN_ENV_FILE=/data/linkedin-admin.env`)
- [x] `auth --port N` (default 3001 via config.json — port externalized, not hardcoded)
- [x] Status table: CLIENT_ID, CLIENT_SECRET, OAuth Token — no Telegram token
- [x] 61 tests (18 new) — all pass
- [x] Published to npm as `k-linkedin-mcp@0.2.0`

## v0.2.1 — Token set fix + agent registration
- [x] `setAccessToken` async — best-effort profile fetch populates `member_id` in token.json
- [x] Status CLI: `State dir` display (cleaner path)
- [x] Registered in Codex, Copilot, Vibe (HTTP primary + stdio fallback)
- [x] Published to npm as `k-linkedin-mcp@0.2.1`

---

## Backlog

### Option B — Unofficial LinkedIn API (future, ToS risk)
> Consider wrapping the unofficial LinkedIn API (reverse-engineered, used by tools like
> `linkedin-api` Python lib) for richer read capabilities: feed, connections list, message inbox,
> job search. Requires cookie-based auth (no OAuth). Risk: ToS violation + account ban.
> Only pursue if official surface proves insufficient for a specific use-case.

### Feature ideas
- [ ] `linkedin_get_feed` — fetch recent feed posts (requires unofficial API or Partner tier)
- [ ] `linkedin_search_people` — people search (requires unofficial API)
- [ ] `linkedin_send_message` — DMs (requires unofficial API or Partner Program)
- [ ] Image upload retry logic (LinkedIn asset upload can be flaky)
- [ ] Multi-account support (multiple token files, account selector)
- [ ] Webhook mode for Telegram (avoid polling)
- [ ] Token expiry push notification via Telegram (warn 7 days before)

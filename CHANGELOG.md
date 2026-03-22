# Changelog — linkedin-mcp

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
- [x] GitLab CI — test → build → deploy pipeline
- [x] Editable install via `bun link`

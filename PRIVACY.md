# Privacy Policy — linkedin-mcp

**Last updated: 2026-03-22**

## Overview

`linkedin-mcp` is a personal tool used exclusively by its author (KpihX / Ivann KAMDEM).
It is not a public service and has no end-users other than the author.

## Data collected

This application does **not** collect, store, or share any personal data from third parties.

The only data persisted is:

- **LinkedIn OAuth token** — stored locally on the author's own infrastructure (`~/.mcps/linkedin/token.json`), containing the access token, expiry date, and the author's own LinkedIn member ID, name, and email. This data is never transmitted to any third party.
- **Admin logs** — operational log lines (auth events, command invocations) stored locally in `~/.mcps/linkedin/linkedin-admin.log`. These logs are never transmitted externally.

## LinkedIn API usage

This application uses the official LinkedIn OAuth 2.0 API with the following scopes:

- `openid` — identity verification
- `profile` — read own profile
- `email` — read own email
- `w_member_social` — post, like, and comment as the authenticated member

All API calls are made exclusively on behalf of the authenticated member (the author) to their own LinkedIn account.

## Third-party services

No analytics, tracking, telemetry, or third-party SDKs are included.

## Contact

For any questions: [GitHub](https://github.com/KpihX/linkedin-mcp)

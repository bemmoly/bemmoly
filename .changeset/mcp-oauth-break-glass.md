---
'@bemmoly/core': minor
'@bemmoly/shared': minor
'@bemmoly/api-client': minor
'@bemmoly/web': minor
'@bemmoly/server': minor
---

MCP clients can now connect by signing in. Point a client that supports MCP sign-in at
`https://<host>/mcp` and it opens your browser: you sign in as usual (password or single
sign-on), see which app is asking, the site that vouches for it and where it sends you back, and
choose read only or read and write and the modules before connecting. The app gets a one-hour
access token bound to that MCP address and a 30-day refresh token that is replaced on every use;
both are stored only as hashes. Connected apps are listed under Settings › Access tokens, where
you can disconnect them, and deactivating a person ends their connections. Personal access
tokens keep working as before. Apps identify themselves with a client ID metadata document;
dynamic client registration is not offered (see `docs/mcp.md` and ADR 0026).

Settings › Sign-in and SSO lists every org admin and lets you make or remove break-glass admins,
who keep password sign-in while single sign-on is required. The confirmation names the person,
each change is audited and every other org admin is told at once (a new "Break-glass admin
changes" notification). While single sign-on is required at least one break-glass admin always
remains: removing, demoting or deactivating the last one is refused.

Schema: changeset `0112-identity-oauth` adds four tables (`oauth_clients`,
`oauth_authorization_codes`, `oauth_grants`, `oauth_tokens`); new tables only, safe to roll back.
Configuration: new optional `BEMMOLY_RATE_LIMIT_OAUTH_PER_IP` (default 60 discovery, token and
revocation requests per address per minute). Client metadata documents are fetched from public
addresses only unless `BEMMOLY_ALLOW_PRIVATE_URLS` is set.

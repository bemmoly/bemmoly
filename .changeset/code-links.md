---
'@bemmoly/core': minor
'@bemmoly/shared': minor
'@bemmoly/api-client': minor
'@bemmoly/core-web': minor
'@bemmoly/ui': minor
'@bemmoly/web': minor
'@bemmoly/module-work': minor
'@bemmoly/server': minor
---

Code links. Connect GitHub (github.com or Enterprise Server, as a GitHub App or with a token) or
GitLab (gitlab.com or self-managed, with a project or group access token) in the new Settings ›
Integrations › Code hosts, and pull requests, branches and commits that name an issue key
("feat/plt-204-sessions", "Fixes PLT-204") show in a Development section on that issue, with
open, draft, merged or closed, checks and review, updated live. Deliveries are verified against
the webhook secret before they are read and applied once, so a redelivery changes nothing; the
card shows the last delivery, a test delivery checks the secret and the token, and a backfill
reads the last 30 days of pull or merge requests. Each project can move its issues when a linked
pull request opens or merges (project settings › Development), within its workflow. The AI issue
summary now reads linked pull requests. New API: `/api/v1/admin/code-hosts` and the anonymous
webhook `POST /api/v1/code-hosts/:id/webhooks`; `GET /api/v1/work/issues/:key/code-links`;
`GET` and `PUT /api/v1/work/projects/:key/code-transitions`. Schema: kernel changeset
`0700-integrations` (integrations, integration_deliveries) and Work changeset
`0024-work-code-links` (code_links, code_transitions); both add tables only. Credentials are
sealed with `BEMMOLY_SECRET_KEY`; self-managed hosts on private addresses work as they do for
identity providers, and `BEMMOLY_ALLOW_PRIVATE_URLS` widens that. No new configuration keys.

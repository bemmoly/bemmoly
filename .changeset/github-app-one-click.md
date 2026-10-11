---
'@bemmoly/core': minor
'@bemmoly/shared': minor
'@bemmoly/api-client': minor
'@bemmoly/web': minor
'@bemmoly/server': minor
---

Connect GitHub in one click. In Settings › Code hosts, Connect GitHub now opens GitHub with a
Bemmoly app ready to create: its webhook, read-only access to pull requests, code and checks,
and the events Bemmoly uses. Create it, choose its repositories, and you are back in Bemmoly
connected, with the last 30 days backfilled. No App ID, installation ID, private key or
repository list to copy by hand; that form is still there under "Enter app details by hand".
Works on github.com (your account or an organization) and on Enterprise Server. If GitHub
cannot reach `BEMMOLY_PUBLIC_URL` (a localhost or private address), the app is created without a
webhook and the dialog says so; backfill still works.

Schema: kernel changeset `0702-integrations-app-slug` (a nullable `app_slug` column on
`integrations`). No new configuration.

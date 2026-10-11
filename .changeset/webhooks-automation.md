---
'@bemmoly/core': minor
'@bemmoly/shared': minor
'@bemmoly/api-client': minor
'@bemmoly/core-web': minor
'@bemmoly/web': minor
'@bemmoly/server': minor
'@bemmoly/module-work': minor
'@bemmoly/module-docs': minor
---

Outgoing webhooks. Admins add endpoints in Settings › Webhooks and pick the events they want:
issues created, updated, transitioned or commented, sprints started or completed, and pages
published or updated. Each delivery is a versioned JSON envelope, or a chat message preset for
chat tools that take incoming webhooks, signed with HMAC-SHA256 in the `bemmoly-signature` header
(`t=<unix seconds>,v1=<hex>`). The signing secret is shown once, when the webhook is made or the
secret is rotated. Failed deliveries retry five times with exponential backoff; the delivery log
shows each attempt's status code and lets an admin send a test delivery or redeliver any event.
A webhook that fails five deliveries in a row turns itself off and tells the admins. Webhook
addresses on private, loopback or link-local networks are refused unless
`BEMMOLY_ALLOW_PRIVATE_URLS` is set, and redirects are never followed.

Automation rules in Work. Project admins add rules in Project settings › Automation, and org
admins add global rules that run in every project: a trigger (issue created, a field changed,
transitioned, comment added, or a schedule), LQL conditions, and actions (set a field,
transition, assign, comment, add a label, send a webhook, notify people). Rules act with the
permissions of the person who last saved them, every action is in the audit log, and the run
log shows each run's outcome. A rule never re-triggers itself, and a chain of rules stops after
five in a row.

Schema: kernel changesets `0113-audit-automation-actor` (audit rows may name the automation
actor) and `0701-webhooks` (new `webhooks` and `webhook_deliveries` tables); Work changeset
`0028-work-automation-engine` (rule owners, schedules and run details). No new configuration.

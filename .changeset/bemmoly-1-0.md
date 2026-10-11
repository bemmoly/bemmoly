---
'@bemmoly/server': major
'@bemmoly/web': major
'@bemmoly/core': major
'@bemmoly/module-work': major
'@bemmoly/module-docs': major
'@bemmoly/deploy': major
---

**Bemmoly 1.0.** Self-hosted issues and docs for your whole team, in one Docker image and one
Postgres, 100% open source under MIT, with no subscription and no in-app purchases. 1.0 changes
nothing you have to act on: it is the release everything below has been building towards, and
from here versions follow Semantic Versioning's usual rules.

- **Work**: projects, issues with custom fields, workflows drawn in a visual editor, Kanban and
  Scrum boards, the backlog and sprints, LQL and saved filters, a roadmap of epics on a
  timeline, and automation rules.
- **Docs**: spaces and a page tree, a live collaborative editor, comments, revisions, issue
  links with live status, Markdown import, and export to Markdown and HTML, or to PDF with the
  optional PDF renderer.
- **AI, optional**: off until an admin turns it on, with any provider from the models.dev
  catalog or a model on your own network: summaries with sources, answers from your docs,
  help in the editor, ⌘K plans you confirm, and an MCP server for AI clients.
- **Imports**: from Jira and Confluence (Cloud or Data Center) or a CSV file, previewed before
  anything is written.
- **Sign-in and people**: single sign-on with OpenID Connect or SAML 2.0, and SCIM 2.0
  provisioning.
- **Connections**: outgoing webhooks signed with HMAC-SHA256, and code hosts (GitHub, connected
  in one click, and GitLab) linking pull requests, branches and commits to issues.
- **Your look**: five themes in light and dark, your brand colour and your own logo.
- **Running it**: one command on a VM, Docker Compose, your own Postgres, a Helm chart or the
  Terraform module; automatic HTTPS, nightly verified backups, and one-click updates with
  automatic rollback.

What 1.0 promises is what the contributor contract already requires of every release
(AGENTS.md §6): every release runs against the previous minor's database and tolerates the
previous minor's clients, so updates and rollbacks are safe within one minor, and security
fixes ship as patches on the current minor. No schema or configuration change.

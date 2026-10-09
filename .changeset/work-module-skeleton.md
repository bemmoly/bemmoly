---
'@bemmoly/module-work': minor
'@bemmoly/core': minor
'@bemmoly/server': minor
'@bemmoly/web': minor
---

The Work module ships in the image, off until an admin enables it in Settings › Modules.
Enabling it runs its schema changelog, which creates the issue tracking tables (projects,
issue types and fields, workflows, issues, links, labels, versions, components, sprints,
boards, saved filters, comments, history, work logs, watchers, attachments and automation
rules) and adds the pg_trgm extension for prefix search, which needs the database owner or a
superuser to have created it on managed databases that do not allow trusted extensions. Once
enabled, "Board" and "Backlog" appear in the top navigation as placeholders and the Work
capabilities (create and configure projects; view, create, edit, move and delete issues;
manage sprints; configure the board) appear in the roles matrix with their defaults. The
screens and the API behind them arrive in later changes of this release. No configuration
change.

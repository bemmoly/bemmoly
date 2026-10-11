---
'@bemmoly/module-work': minor
'@bemmoly/core': minor
'@bemmoly/core-web': minor
'@bemmoly/shared': minor
'@bemmoly/web': minor
---

Workspace admins can now change Work's org defaults in Settings › Modules › Work: the issue
types, fields, workflow and board (columns, swimlanes, quick filters, cards, sprints and
estimation) that every project inherits until it overrides them. Each page says how many projects
use the default and which have their own version. A change to the default board reaches every
project still following it at once; a project that changed or overrode its board keeps its own.
A project's Board, Issue types and Fields pages link workspace admins to the matching default,
and Reset to default now makes a project follow the default again. Settings › Modules › Manage
modules still turns modules on and off.

Only workspace admins can change the org defaults; anyone else, including people with the Project
admin workspace role, now gets a 403. Modules can declare their own settings page in their
manifest (`settings: { path: '/settings/<id>' }`).

Schema: one Work changeset, `0026-work-default-board`, seeds the org default board ("Workspace
board") from the org default workflow on new and existing installs; it is quick and reversible.
No configuration change.

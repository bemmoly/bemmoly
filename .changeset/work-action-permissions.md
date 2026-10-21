---
'@bemmoly/module-work': minor
'@bemmoly/web': minor
---

Admins can grant or deny specific Work actions per role, for example letting only a Scrum
Master create, start and complete sprints. Settings › Work › Permissions shows every Work action
by role; the same rows appear in Settings › Roles, and a project role still decides inside its
project. New actions: Create sprints, Start sprints, Complete sprints, Manage epics, Configure
workflows and Edit automation. "Start and complete sprints" is now "Edit and delete sprints".
The server enforces each action, and the board, backlog, issue menus, workflow editor and
automation settings hide or disable what a person's role does not allow.

Nothing changes until an admin edits the matrix: each new action starts with the cells of the
action it was split from, for every role and every project override.

Schema: one changeset (0035) copies stored role cells onto the new actions. It is fast and
reversible.

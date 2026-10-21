---
'@bemmoly/module-work': minor
'@bemmoly/web': minor
---

Work has initiatives: programs of epics that span projects and teams. The API creates, edits,
archives and unarchives them, links and unlinks epics, and reports each one's rolled-up
progress (epics done, issues and points done) over the projects the reader can open. The
roadmap reads one initiative with `?initiative=<id>`, showing only its epics across teams.

Roadmap dependencies now include "blocks" links between issues under different epics, in the
same project or across projects, drawn as a dependency between their epics. Each dependency
says whether it is an epic link or rolled up from issues, how many links it stands for, and
whether its dates conflict (the waiting epic starts before its blocker ends). Forecasts wait on
these too.

A new role capability, "Manage initiatives", is on for org admins, project admins and members.

Schema: one changeset (0035) adds `initiatives` and `initiative_epics` with their indexes. It is
fast and reversible.

---
'@bemmoly/module-work': patch
---

Fixes found by the new Work integration tests:

- Issues created at the same time in one project get distinct board ranks.
- `?deleted=false` and `?archived=false` mean false; before, any value listed the trash or
  included archived projects.
- A transition whose validator asks for a field (an estimate, say) accepts that field in the
  same request that moves the issue.
- Moving an issue answers with what the transition's post-actions changed, and open boards and
  issue pages refresh to show it.
- Post-actions and workflow publishes record history with the same field names as every other
  change, so one issue's history reads as one list.
- Notifications reach only people who can open the issue's project; a mention or an old watch
  no longer sends the issue's title and comment to someone outside it.
- An issue can only carry labels, a fix version and a component of its own project.
- Typing a full issue key suggests that issue before keys that extend it.

---
'@bemmoly/module-work': patch
'@bemmoly/ui': patch
---

Board cards now draw exactly the card layout set in Project settings › Board › Cards, on Scrum and
Kanban boards alike. Every field there has a place on the card: issue type, key, priority, labels,
estimate, assignee, linked docs, blocked, due date (red once overdue), subtask progress, reporter,
created date and the new "Time in column". Fields show in the order the settings list them, and a
field shows only on cards whose issue has a value for it (an unassigned card shows the empty
assignee ring). Before, Kanban cards ignored Estimate, always showed the time in column ("0d")
and the done tick, the type always showed, and due date, reporter and created date never did.

Card color "By epic" and colour rules on `epic` now paint on any board, not only when the lanes
are epics. The settings preview is the board's own card, with a second sample showing an issue
without values. Board settings compare the board with Work's default board when the org has no
default board scheme, so the "Based on…" note counts changes and "Reset to default" works.

Kanban boards that want the time in column back turn on "Time in column" in Cards. No
configuration or schema change. That field is new in stored board settings: before rolling back to
0.11.0, turn it off, or that version shows the board as two empty columns.

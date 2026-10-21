# Initiatives

**Primary job.** See whether a program of work that spans several teams will land: its
epics from every project on one timeline, how far along they are, what waits on what, and
which epics are at risk, without building a dashboard by hand.

**Where it lives.** "Initiatives" in the Work section's links (`/work/initiatives`), the
`contained` layout: a filter row (Live, Archived) and a table. One initiative opens at
`/work/initiatives/<id>`, the `full` layout: its header strip (dates, owner, rollup tiles),
the at-risk strip, then the Roadmap's own timeline limited to its epics (ADR 0048).

**What is on it.** The table: name and description, epics done of total, a progress bar of
issues done, the target date, how many projects, and the row menu (Edit, Archive or
Unarchive). The program view: tiles for epics done, issues done, at risk or late, and date
conflicts; then the timeline, where a dependency between two epics is a line, amber and
dashed when the waiting epic starts before its blocker ends. A dependency can come from a
card in one team blocking a card in another (an issue link): it is drawn between their epics.

**Top three actions.**

| Action             | Mouse                              | Keyboard                                 | Touch          |
| ------------------ | ---------------------------------- | ---------------------------------------- | -------------- |
| Open an initiative | Click the row                      | Tab to the row, Enter                    | Tap the row    |
| Link an epic       | "Link epic" in the header          | Tab to it, Enter; type to search, Enter  | Tap it         |
| New initiative     | "New initiative" in the header     | Tab to it, Enter; Mod+Enter creates      | Tap it         |

**Keyboard map.** The list adds no single keys. The program view's timeline keeps every key
of the Roadmap (↑ ↓ J K, ← →, F, T, W M Q, Enter, Esc); none is new or global.

**States.**
- Loading: the table skeleton; on the program view, the Roadmap skeleton.
- Empty list: "No initiatives yet", what one is, "New initiative" (for people who manage).
- Archived empty: "Nothing archived".
- Program without epics: "No epics in this initiative yet", "Link epic".
- Error: "Initiatives could not be loaded" with Retry, in the frame.
- Partial: epics in projects the person cannot open are left out and the header says how many.
- No permission: people without "Manage initiatives" see no New, Edit, Archive or Link; the
  unlink control is left out of the linked-epic list.
- Archived: the program view says so under the title with Unarchive; linking is off.

**URL state.** The list's `show` (archived); the program view keeps the Roadmap's `zoom`,
`group`, `q`, `team`, `issue` and `forecast`.

**AI.** None. Rollups and forecasts are arithmetic and drawn in neutral and signal colours.

**Choices recorded.**
- The program view is the Roadmap with a filter, not a second timeline: one set of bars,
  drags and keys.
- At risk counts forecasts "At risk" and "Late"; date conflicts are counted on their own,
  because a conflict can hold up an epic that is still on track.
- The timeline groups by project, as the all-projects Roadmap does; Team is one click away.

---
'@bemmoly/web': minor
'@bemmoly/ui': patch
'@bemmoly/core-web': minor
'@bemmoly/editor': patch
'@bemmoly/module-work': patch
'@bemmoly/module-docs': patch
---

An accessibility pass to WCAG 2.2 AA across the product. Every signed-in screen starts with a
**Skip to content** link, and every screen has a level-one heading. Backlog rows are grid rows,
and a keyboard move there now says where the row landed. Small targets (removing a label, the
actions under a comment, Assign to me) are at least 24px. Muted text stays readable on selected
rows in Inbox and ⌘K, and amber avatars are a shade darker so their initials meet 4.5:1. Links
inside a sentence are underlined. A WCAG audit of every screen, in all five themes, light and
dark, desktop and phone, now runs in CI; `docs/accessibility-conformance.md` says what is
covered and how to report a problem.

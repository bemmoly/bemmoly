---
'@bemmoly/web': minor
'@bemmoly/core-web': minor
'@bemmoly/ui': minor
'@bemmoly/module-work': minor
'@bemmoly/module-docs': minor
---

Every signed-in screen now sits in one frame: a sidebar with the Bemmoly mark and your workspace,
Search and New, Home, Inbox and My issues, then Work's projects with their Board, Backlog and
Settings and Docs' spaces, with Settings, Help, the version and your account at the foot. The top
bar is gone. Press `[` to fold the sidebar to a narrow rail (it remembers), and on a phone the
sidebar opens from the menu button with a bottom bar for Home, Inbox, New and My issues. Settings
use the same sidebar, and Esc takes you back to where you were.

Creating opens over the page you are on instead of taking you elsewhere. ⌘K shows what you opened
recently and what the current screen can do, Tab filters it by type, and `?` lists every
shortcut, including C for a new issue, `/` to search and G chords to move between places.

The Inbox is a two-pane triage view: Mentions, Reviews and Assigned segments, items grouped by
day, the issue itself beside each item, and J/K to move, E to mark done and S to snooze, each
with Undo. Home shows your issues by status, the inbox and the current sprint, and an issue
opened from either steps through that list with J and K. Sign-in pages lead with your workspace
and say "Powered by Bemmoly", tab titles name the page and the workspace, and a missing or broken
page stays inside the frame with a way back. Once a workspace logo can be uploaded, it leads the
sidebar with "on Bemmoly" under it. No configuration or schema change.

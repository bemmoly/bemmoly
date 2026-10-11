# Accessibility conformance

Bemmoly aims to meet the **Web Content Accessibility Guidelines (WCAG) 2.2, level AA** on every
screen of the product: sign-in, the setup wizard, Home, Inbox, Work, Docs, Settings and the
command palette. This page says what is tested, how, what does not meet the standard yet and
what we will do about it, and how to tell us about a problem.

Last reviewed: 11 October 2026.

## What is covered

### Every screen, automatically, on every pull request

The **Accessibility** check in CI (`apps/web/e2e/a11y/screens.spec.ts`) opens each screen
below and runs [axe-core](https://github.com/dequelabs/axe-core) on it with **every rule on**:
WCAG 2.0, 2.1 and 2.2 at A and AA, colour contrast included, plus axe's best practices
(landmarks, one `main`, one `h1`, heading order). It runs each screen in **all five themes**
(Bemmoly, Graphite, Sand, Pine, High contrast), **light and dark**, at **desktop width and at
390px**, with reduced motion. Any violation fails the build.

| Area           | Screens                                                                                                                                                                                                                                                                                                                                                                 |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Before sign-in | Sign in (password, session ended, single sign-on), forgot password, reset password, accept invitation, the seven steps of the setup wizard                                                                                                                                                                                                                             |
| Everywhere     | Home, Inbox, My issues, ⌘K                                                                                                                                                                                                                                                                                                                                              |
| Work           | Board, Backlog, Roadmap, the Issue page, the issue slide-over, Create issue, Projects, project settings (Board, Issue types, Fields, Development, Automation), project members, Workflows                                                                                                                                                                              |
| Docs           | Docs home, a space, the page editor, comments, version history                                                                                                                                                                                                                                                                                                         |
| Settings       | Profile, Access tokens, Notifications, Workspace, Appearance and the theme editor, Email, AI (setup, privacy, usage, prompts), MCP, Webhooks and a webhook, Users, Teams, Roles, Sign-in and SSO, Modules, Import, Code hosts, Backups, Updates, System, Audit log, and Settings › Work (Issue types, Fields, Workflow, Board)                                           |

The screens run against the same in-browser mock backend the dev server uses, with its seeded
workspace, so every screen has real content to check rather than an empty state.

### What axe cannot check, tested by hand and in `a11y/keyboard.spec.ts`

| WCAG                                           | What we check                                                                                                                                                                                                                                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1.1 Keyboard                                 | Create an issue, move a board card, plan a sprint (move a backlog row), write in a doc, comment from the selection toolbar and change a setting, with the keyboard alone.                                                                                                             |
| 2.4.1 Bypass blocks                            | **Skip to content** is the first Tab stop of every signed-in screen and moves focus to `main`, past the sidebar. Every screen has one `main`, a named sidebar landmark and an `h1`.                                                                                                     |
| 2.4.3 Focus order, 2.4.7 Focus visible         | Focus follows reading order; every interactive element shows the 2px accent ring on keyboard focus. Menus, ⌘K and dialogs trap focus while open and return it to what opened them.                                                                                                   |
| 2.4.11 Focus not obscured                      | Tabbing through Backlog, Profile and Notifications at desktop and 390px, no focused control is hidden under the sticky header, the bottom bar or a toast.                                                                                                                             |
| 2.5.7 Dragging movements                       | Everything a drag does has a single-pointer way: a board card's status from its slide-over, a backlog row's **Move to** menu, a page's **Move** dialog, a roadmap item's dates from its fields. The board, backlog and page tree also move with the keyboard (space, arrows; Alt+arrows). |
| 2.5.8 Target size                              | No target is under 24 by 24px (axe), and the system's own floor is 32px, 44px on touch.                                                                                                                                                                                              |
| 2.3.3 Animation, reduced motion                | With `prefers-reduced-motion: reduce`, no element animates or transitions.                                                                                                                                                                                                            |
| 4.1.3 Status messages                          | Toasts are `status` (errors `alert`); a doc's save state, a keyboard move and a refused drop are read out from live regions.                                                                                                                                                          |
| 3.3.8 Accessible authentication                | Sign-in asks for no puzzle or CAPTCHA, lets you paste the password, and marks its fields for password managers (`username`, `current-password`, `new-password`). Single sign-on is offered where the workspace has it.                                                                |
| 3.2.6 Consistent help, 3.3.7 Redundant entry   | **Help and shortcuts** sits in the same place in the sidebar on every signed-in screen, and **?** opens the shortcuts from anywhere. No flow we checked asks for the same information twice.                                     |
| 4.1.2 Name, role, value                        | Role and name are asserted on the key widgets: the page tree (`tree`, `treeitem` with `aria-level`), the backlog (`grid` rows), the board's cards, the comboboxes, the editor's selection toolbar (`toolbar`, every button named).                                                       |

Before a release we also walk the main flows once with VoiceOver on macOS and NVDA on Windows.

## Known exceptions

Each has an owner and a plan. None blocks a task; each makes one harder than it should be.

| Where                                                    | What                                                                                                                                                                                                                         | Plan                                                                                                                                                                                                  |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Menus on touch                                           | Menu rows are about 33px tall on touch: above the 24px minimum of 2.5.8 (AA), under our own 44px touch target.                                                                                                               | Taller rows under `pointer: coarse` in `Menu`, with the menu's own story in every preset, in the next design-system pass.                                                                           |
| The bulk bar at 390px                                    | With many issues selected the bulk bar scrolls sideways on a phone. Every action is reachable, but by a horizontal scroll (1.4.10 Reflow allows it for toolbars; it is still awkward).                                     | Fold the less common actions into a **More** menu below 480px.                                                                                                                                         |
| Live collaboration                                       | Another person's edits to a doc you are reading appear without being announced, and their cursors are drawn, not spoken. Their presence is announced in the header.                                                          | An opt-in "announce others' edits" setting that reads a summary ("Amir edited Context") at most every 10 seconds.                                                                                    |
| Realtime board and backlog changes                       | When someone else moves a card, it moves; a screen reader is not told.                                                                                                                                                       | A polite, throttled announcement of others' moves on the board and backlog you have open, with the same words as your own moves.                                                                     |
| Native checkboxes in the editor                          | A task list's checkbox while editing is the browser's own, 13px. 2.5.8 exempts a control whose size the browser sets and the author has not changed, so this conforms, but it is small; the audit leaves this one node out of axe (`a11y/axe.ts`) because axe cannot see the exemption.                                     | Draw the checkbox at 16px with a 24px hit area, matching `Checkbox`, when the editor's task list moves onto the shared component.                                                                    |
| ⌘Enter in Create issue                                   | ⌘Enter creates the issue from the title and description, but not while focus is on one of the dialog's selects (type, project); Tab back to a text field first, or Tab to **Create issue**.                         | Let the dialog take ⌘Enter from every field, selects included, and cover it in `a11y/keyboard.spec.ts`.                                                                                             |
| The demo build                                           | The public demo (`/demo` on the marketing site) runs the same screens and inherits this conformance, but its banner has not been audited on its own.                                                                         | Add the banner to the audit when the demo is next released.                                                                                                                                         |

The automated audit cannot prove conformance on its own: it finds about half of the problems a
person would. That is why the keyboard, focus and screen reader checks above exist, and why we
want to hear from you.

## Reporting a problem

If something in Bemmoly is hard or impossible to use with your setup, tell us:

- **GitHub**: open [a bug report](https://github.com/bemmoly/bemmoly/issues/new?template=bug.yml)
  and start its title with **Accessibility:**. Say what you were trying to do, the screen, your
  browser and assistive technology (and their versions), and what happened.
- **Questions** ("is there a way to…?") go to
  [Discussions › Q&A](https://github.com/bemmoly/bemmoly/discussions/categories/q-a), as
  [SUPPORT.md](../SUPPORT.md) describes.
- A problem that exposes someone's data is a security report: follow
  [SECURITY.md](../SECURITY.md), never a public issue.

We treat an accessibility problem that blocks a task as a bug of the highest priority: we aim to
reply within five working days and to fix a blocker in the next release. A fix lands with a
check in the audit so it stays fixed.

## For contributors

- The rules are in [docs/design/system/accessibility.md](design/system/accessibility.md); the
  checklist every pull request carries is in
  [definition-of-done.md](design/system/definition-of-done.md).
- Run the audit locally: `pnpm turbo run build --filter=@bemmoly/web`, then
  `pnpm --filter @bemmoly/web test:a11y` (all themes; `A11Y_THEME=pine` for one).
  `A11Y_REPORT=findings.jsonl` records findings instead of failing, for an audit of your own.
- A new screen adds itself to `apps/web/e2e/a11y/screens.ts`.

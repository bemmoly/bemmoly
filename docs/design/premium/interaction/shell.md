# Shell: the frame, its sidebar, the palette, Home, Inbox and the pages around them

Covers everything a signed-in person sees around a module's content, plus the screens before
sign-in. Module screens own what sits under the header; this file owns the header itself.

## The frame

- **Primary job.** Be the same on every screen, so the way on is always in the same place.
- **Shape.** A 240px sidebar, then the page: a sticky 52px header (breadcrumbs, view tabs,
  presence, actions) over one scroll region the layout owns. No top bar. Two layouts only:
  `full` (Board, Backlog, Inbox, editors; full bleed, 24px gutters, the screen scrolls its own
  panes) and `contained` (Home, Projects, Settings, the Issue page; a 1040px reading column).
- **Sidebar, top to bottom.** The brand block (mark and wordmark, the workspace small under it,
  its chevron opening the workspace menu: Workspace settings, Invite people, What's new, About;
  never a switcher), Search (⌘K) and New (C, with a menu of every create), Home / Inbox (unread
  pill) / My issues, then one section per module in manifest order (Work: the projects, the one
  in use opened to Board, Backlog and Settings; Docs: its spaces), then Settings, Help and
  shortcuts, the version line ("Bemmoly 0.3.0 · What's new") and the person's menu (Profile,
  Notification preferences, Theme, Sign out).
- **The project in use.** The path's project when it names one, else the person's last project
  while it still exists, else the first listed. The sidebar and Work's screens make the same
  choice, so a first visit to Inbox already shows a project's views.
- **A customer logo.** When the workspace has one the page may load (served by the install, or
  inline), line one is their logo and name, line two "on Bemmoly" with the mark; the rail leads
  with their logo and keeps the Bemmoly mark at its foot (tooltip: version and What's new).
  Custom themes never recolour the mark. Without one, nothing changes.
- **Rail.** `[` (or the sidebar button) folds to the 56px rail, remembered per person. Below
  1100px the rail is automatic and `[` unfolds the full sidebar over the page; a click outside,
  Escape or going somewhere folds it again. Every rail button has a tooltip with its name and
  shortcut.
- **Phone (under 768px).** The sidebar is a sheet behind the header's menu button (going
  somewhere closes it); a bottom bar holds Home, Inbox, New, My issues and the first module's
  area. The header keeps only the current crumb; tabs and actions move to rows under it that
  scroll sideways. Nothing scrolls the page sideways at 390px.
- **Settings mode.** On /settings the same sidebar lists the settings pages, with "Back to app"
  and Esc at the top; Esc returns to the page the person came from (Home after a reload).
- **States.** The sidebar's module sections show their heading and fixed links at once and fill
  in their live rows when the small sidebar file lands; a section that fails says so in one
  line. A page that throws is caught inside the frame (see Failure), so the sidebar stays.

## Page header

- Every crumb links, the current one included (`aria-current`). The project crumb is a
  searchable switcher. Screens refine the trail's end once their data is in ("Auth service /
  PLT-204") without the header moving. Screen buttons are portalled into the header, so it stays
  put while the screen loads.
- Tab titles read "page · context · Bemmoly". A page whose title has one part takes the
  workspace as context ("Inbox · Acme Labs · Bemmoly").

## Global keys

| Key | Does |
| --- | --- |
| ⌘K / Ctrl K | Open or close the palette |
| / | Open the palette (search) |
| C | The primary create (New issue) over the current page, with its project and sprint |
| [ | Fold or unfold the sidebar |
| ? | The shortcuts overlay |
| G H, G I | Home, Inbox |
| G + a module's letter | That module's place (G B Board, G L Backlog) |

Single keys and chords never fire while typing in a field, inside an open dialog or menu, or
with Alt held; ⌘K works everywhere. A chord waits one second for its second key.

## Create in place

New and C open the module's dialog over the page the person is on (`?create=` in the address,
so Back closes it); closing it leaves them exactly where they were. Nothing navigates to a
route that draws another screen behind the dialog.

## Command palette (⌘K)

- **Primary job.** Get anywhere or do anything by name, without the mouse.
- **Empty.** Recent (what was opened, issues with their type tile and status), then this
  screen's actions first ("Assign PLT-204 to me", "Move PLT-204 to In progress"), then creating
  (New issue on C, drawn with the New button's plus), inviting, theme, shortcuts, sign out, then
  places with their G chords.
- **Typing.** Module search providers (issues by key and words, pages), people, settings pages
  and actions, ranked together. Tab and Shift Tab move between All, Issues, Pages, People,
  Settings and Actions; a recent item stays under its own type.
- **AI.** The AI line and the plan preview appear only when the workspace has AI on, in lilac.
- **States.** Searching keeps the last results until new ones land, so the list never blinks;
  if the server search fails, the local results (settings, actions, places) still answer. The
  scrim is flat, like every dialog's.

## Shortcuts overlay (?)

Everywhere, Lists and dialogs, Go to, and a group per screen that registers its own keys (the
Inbox's J K, Enter, E, S). Esc or the close button returns focus to whatever had it.

## Home ("Your work")

- **Primary job.** Show what needs the person today and get them back into it.
- **Top actions.** Open an issue from My issues; open an inbox item; jump back into something
  recent.
- **Layout.** The greeting and "N things need you today", Jump back in (the last places
  opened), then My issues (Assigned, Created, Watching, Mentions, grouped by status) beside the
  Inbox preview and the current sprint.
- **List memory.** Opening an issue from My issues hands the issue page that tab's issues in
  the order drawn, so j and k there walk the same list.
- **States.** Shaped skeletons per card; a card that fails says so with Try again and the
  others stay; no modules on says where work comes from with the one next step (an admin gets
  "Open Settings › Modules"); Docs without Work offers C and ⌘K. On a phone the cards stack,
  segments scroll inside their card and rows drop "Updated" to keep the title.

## Inbox

- **Primary job.** Work through what asks something of you, and leave each item dealt with.
- **Top actions.** Open the item, mark it done (E), snooze it (S).
- **Layout.** Two panes. Header: All · count, Mentions, Reviews, Assigned as segments, Mark all
  read, and a menu for Snoozed and Done. The list groups Today, Yesterday, Earlier, with the
  module's mark, unread dots and the accent edge on the selected row. The detail shows the item
  in context: what it is about, drawn by the module that owns it (Work's issue row: type, key,
  title, status, as a link), the message, then Snooze, Done and Open.
- **Keyboard.** J K (and the arrows when the list has focus) move; Enter opens; E marks done
  and S snoozes until tomorrow morning, each with Undo for six seconds; the selection moves to
  the next item.
- **Address.** Segment, view and the item on show live in the address. The first item shown
  without one chosen is written into it, so a new item arriving above never takes the selection
  or gets read unseen, and a refresh keeps the same item.
- **List memory.** Opening an issue from the Inbox hands the issue page the Inbox's issues in
  order, so j and k there walk the Inbox.
- **States.** Skeleton rows; an error with Try again; empty per view ("You're all caught up",
  "Nothing snoozed", "Nothing marked done yet") and per segment. On a phone the list is the
  page and the detail replaces it with a Back button.

## Sign-in, password reset, invitations

The customer's workspace leads the card (its tile and name), "Powered by Bemmoly" with the
mark sits under it; before the workspace has a name the Bemmoly lockup leads. Fields validate
on blur and on submit, the button shows progress and never double-submits, and errors say what
to do next. Titles read "Sign in · Acme Labs · Bemmoly".

## Boot

index.html paints the Bemmoly mark over a quiet progress bar from the stylesheet alone, before
any script runs; it leaves in one frame when the first page renders, with no layout shift.

## Not found and failure

Both sit inside the frame, so the sidebar is still the way on. The trail is Home, then "Not
found" or "Something went wrong", never Home as the current page. Not found offers search
(⌘K); a failure says what happened in plain words with the request id, Try again, and Go to
Home. A module chunk that fails to load gets the same failure with Try again.

## Choices recorded

- The review draws Approve and Request changes in the Inbox detail. There is no review action
  in the product yet, so the detail offers Open, Snooze and Done; the actions land with reviews.
- The review's Inbox list shows each issue's title. The notification carries the key, not the
  title, so the list shows the key and the detail shows the module's full row.
- The boot frame follows the default light theme; a dark-mode person sees it light for the
  moment before the app applies their theme (the CSP forbids the inline script that would
  read their choice first).

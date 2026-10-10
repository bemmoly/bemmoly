# Dialogs

Every dialog is the one `Modal` in `packages/ui`: a native `<dialog>` on the top layer, e3
elevation, a flat scrim with no blur, 180ms rise in and 100ms out (still under reduced motion),
focus held inside and returned to the opener. The footer sits outside the scrolling body, so
its buttons never scroll away. Under 640px every dialog is a full-screen sheet with the footer
held above the home indicator. Widths: sm 400, md 480, lg 640, composer 720, xl 760.

## Create issue

- **Job:** capture an issue in seconds without leaving the page.
- **Top actions:** type a title, set the few properties that matter, create.
- **Keys:** C opens it (shell); Mod+Enter creates from any field; Enter in the title never
  submits (a title is one line, but Enter is too easy to hit by accident); Escape closes, or asks
  first when anything is typed (Keep editing has focus, so a second Escape keeps editing).
- **Layout:** project › type pickers in the header, a borderless 20px title, the issue page's
  editor for the description (/ for blocks), the type's required document fields as bordered
  sections labelled "Required for stories", then properties as chips (status, priority,
  assignee, labels, sprint, points, epic). ··· reveals the type's other fields; a required field
  or one with an error is always shown.
- **Defaults:** the opener's context (column status, sprint on screen, epic lane, assigned to
  me). A status other than the first is applied right after create; if the workflow refuses it
  the toast says where the issue landed.
- **After create:** a toast "Created KEY" with Open KEY. With Create another on, the form resets
  (project and type kept) and the title has focus again.
- **States:** layout loading shows a chip-row skeleton; server field errors land under their
  field, chip errors are spelled out under the chip row; a form-level error sits in the footer.
- **Phone:** sheet; Create another and the shortcut hint are hidden.

## Sprint start, edit, complete

- Start and edit share one form (name, dates, goal; edit adds capacity, and before the sprint
  starts, Delete, which asks once in place because it moves issues to the backlog).
- Complete leads with a summary: "% done" and a progress bar by points (by count when nothing is
  estimated), then completed and unfinished tallies, then where unfinished work goes (next
  planned sprint, backlog, or a new sprint created on the way).

## Saved filters

- Save names the board's applied LQL and its audience (only me, or one of my teams).
- Manage lists my filters; Rename is inline (Enter saves, Escape cancels without closing the
  dialog). Delete happens at once with an Undo toast that saves the filter again as it was
  (it gets a new id; nothing else refers to it).

## Link issue

- Keyboard first: the issue search has focus on open; choosing an issue moves focus to Link so
  Enter finishes; Mod+Enter links from anywhere. The relation select is labelled with this
  issue's key so the sentence reads "PLT-12 blocks PLT-40". The toast names both issues.

## Create project

- Name derives the key until the key is typed. Scrum or Kanban is the template. A preview shows
  the tile and "Issues start at KEY-1". Choosing a team shows its lead with an avatar.
- **Not built:** a project colour. Projects have no colour column; the tile colour is derived
  from the name, as everywhere else. Adding one needs a schema changeset and is left for later.

## Add members, settings dialogs, publish workflow

These already sit on the shared Modal and form components, so they take the new frame, sheet
and footer without page-level changes.

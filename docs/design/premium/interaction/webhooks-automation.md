# Settings › Webhooks and project settings › Automation

How an admin sends Bemmoly's events to other tools, and how a project admin makes Work act on
its own. Webhooks live in the settings frame (`contained`), in the Workspace group after MCP
server. Automation is a project settings tab beside Board, in Work's frame (`contained`). Nothing
here is AI output, so nothing is lilac; a rule the AI drafted is still a rule an admin saves.

## Settings › Webhooks (`/settings/webhooks`)

**Primary job.** Point the workspace's events at another tool, and see at a glance which
receivers are healthy.

**Shape.** One reading column. The page title and line, then the one table: name with the
receiving host under it in mono, events ("3 events"), format, status and last delivery. Status is
a state pill: Active (green), Paused (neutral), Failing (red) with the reason on a second line.
"New webhook" is the primary action in the header. Rows open the webhook.

**New webhook and Edit.** A `Modal` (lg; a sheet on phones): Name, URL (mono, http or https),
Events as checkboxes grouped under each enabled module's name (a module that is off offers
none), Format as radios with a preview of the body the preset sends, and "Send deliveries" as a
checkbox (chosen, then saved). Validation sits under each field. Create answers with the signing
secret: the dialog turns into "Copy the signing secret" with the secret in a copy field, a line
saying it will not be shown again, and how to verify a delivery. Done opens the new webhook.

**Top three actions.**

1. New webhook: the header button, reached first by Tab after the frame; Mod+Enter submits the
   dialog from any field.
2. Open a webhook: arrows or J K move between rows, Enter opens, as every table.
3. Turn a failing webhook back on: from its page (below).

**Keyboard map.** No single-letter keys; the table's arrows and Enter, the dialog's Esc and
Mod+Enter. Checked against the global map: nothing new.

**States.**

- Loading: the table skeleton with the loaded tracks.
- Empty: "No webhooks yet" / "Send issue and page events to chat tools or your own services." /
  New webhook.
- Error: the settings failure with Retry and the request id.
- Many (hundreds): one table, names truncate with the full name on hover.
- No permission: the page is not in the sidebar without "Manage workspace settings"; the route
  sends people elsewhere, and a refusal from the server shows "You can't manage webhooks".
- Phone (390px): name, status and the open affordance stay; events, format and last delivery
  hide.

**URL state.** The open dialog (`?create=webhook`); the open webhook is its own address.

## A webhook (`/settings/webhooks/<id>`)

**Primary job.** Know whether this receiver gets what it should, and fix it when it does not.

**Shape.** The title is the webhook's name, the line its URL. Header actions: Send test,
Edit…, and ··· (Rotate secret…, Delete webhook…). Then:

1. **A failing banner** when the webhook turned itself off: "Turned off after 5 failed deliveries
   in a row", the reason in the receiver's words, and "Turn back on" (which also clears the
   count).
2. **Endpoint**: "Send deliveries" (a `Switch`, applies at once), events, format, and the signing
   secret's last four characters with "Rotate secret…".
3. **Test send result** after Send test: the state pill, response status, duration and the
   error or the receiver's first words. The test lands in the log too.
4. **Verify deliveries**: the four header names, the signature format
   (`t=<unix seconds>,v1=<hex>`, HMAC-SHA256 of `${t}.${rawBody}` with the secret) and the
   five-minute replay window.
5. **Deliveries**: a status filter (All, Succeeded, Failed, Retrying, Pending), the one table
   (state, event, attempt "2 of 6", response status, duration, when, Redeliver on every row) and
   Load more.

**Delivery details.** Opening a row (click or Enter) opens "Delivery details": the same facts,
the error, the receiver's first 500 characters, the event and delivery ids, and Redeliver.

**Top three actions.** Send test (header), Redeliver (row button, or the dialog), Turn back on
(banner button). All are plain buttons in reading order.

**Rotate and delete.** Rotating replaces the secret at once and cannot be undone, so it asks
first (`ConfirmChange`), then shows the new secret once. Deleting removes the webhook and its log
for good, so it asks with the webhook's name.

**States.**

- Loading: section skeletons, then the log's table skeleton.
- Not found: "This webhook was deleted" with "All webhooks".
- Empty log: "No deliveries yet" / "Send a test to see one here." / Send test. Filtered empty:
  "No deliveries with this status" / Clear filter.
- Error: the settings failure with Retry; a failed test or redelivery is a danger toast with
  the server's words.
- Many: keyset Load more under the table.
- Phone: attempt, response, duration and when hide; state, event and Redeliver stay (the
  details dialog has the rest).

**URL state.** The log's status filter (`?status=failed`), the open delivery
(`?delivery=<id>`) and the Edit dialog (`?edit=1`), so reload and Back restore them.

**Choices recorded.**

- The brief asks for a delivery's error and excerpt "on expand". The one `Table` has no
  expandable rows and a second table style is not allowed, so a row opens a details dialog
  instead, addressed in the URL like any open item.
- "Send deliveries" is a checkbox inside the dialog (chosen, then saved) and a `Switch` on the
  webhook's page (applies at once), as components.md separates the two.
- Rotate asks first rather than offering Undo: the old secret is gone the moment it rotates.
- Redeliver in a row is an icon button (its tooltip says Redeliver, its name says which
  delivery) so the row fits a phone; the details dialog carries the labelled button.

## Project settings › Automation (`/work/settings/<KEY>/automation`)

**Primary job.** Make the project's routine moves happen by themselves, and see what each rule
did.

**Shape.** The page title and line, then a segmented control: Rules · N and Run log. Rules
shows this project's rules in the one table (name with what it does under it, last run as a
state pill and time, an enabled `Switch`, a ··· menu), then Global rules, which run in every
project, with a line saying who can change them. "New rule" is the primary header action.

**Rule builder.** A `Modal` (xl; a sheet on phones) that reads as a sentence:

- **When**: a trigger `Select` from the catalog, then its arguments: fields to watch, a from and
  to status from this project's workflow, or a five-field schedule in UTC.
- **If**: conditions, each an LQL field with the shared autocomplete and the problem underlined
  as it is typed. Every condition must match. A scheduled rule needs at least one.
- **Then**: an ordered list of actions, each with its own argument editor: a status from the
  workflow, a label by name, a person from the people picker, a webhook from the workspace's
  webhooks, a comment or a message. Move up, Move down and Remove per action; "Add action" is a
  menu of the catalog.
- "Runs as Rohan Mehta" under the name: the actions use the permissions of whoever saved the
  rule last, so saving makes it run as you, and the line says so.
- "Turn on when saved" (a checkbox), Cancel and Save rule.

**Test run.** "Test run…" in a rule's ··· menu asks for an issue key and
runs the rule against it now. The page switches to the run log and opens the new run, whose
state follows it from queued to done.

**Run log.** A status filter (All, Succeeded, Failed, Skipped, Running, Queued), then the one
table: state, rule (and the error or "Stopped: rules triggered each other 5 times in a row" under
it), trigger, issue key (a link to the issue), depth, actions ("2 of 2 done"), duration and when.
Opening a row shows each action's outcome in words.

**Top three actions.**

1. New rule: the header button; Mod+Enter saves from any field of the builder.
2. Turn a rule on or off: Tab to its switch, Space toggles; it applies at once and rolls back with
   a toast if the server refuses.
3. Test a rule: the row's ··· menu (or right-click), Test run…, type a key, Enter.

**Keyboard map.** Rows: arrows or J K, Enter opens the builder (or the run's details), the row
menu opens with Enter on its button. Nothing single-letter; nothing collides with the global map.

**Delete.** Deleting a rule happens at once with Undo for about six seconds; Undo saves it again
(it runs as you from then on, as any save does).

**States.**

- Loading: the table skeleton with the loaded tracks; the builder's pickers say "Loading…".
- Empty: "No rules yet" / "Rules move issues, assign people and tell other tools when something
  happens." / New rule. No global rules: the section says none run here.
- Empty log: "No runs yet" / "Runs appear when a rule's trigger happens, or when you test one."
  Filtered empty offers Clear filter.
- Error: the failure panel with Try again and the request id; a refused save stays in the dialog
  with the server's words, the typed rule intact.
- Many: hundreds of runs page with Load more; rule names truncate (the builder and the run's
  details show them whole).
- No permission: without "Configure project" every rule reads only (switches off, "View" in place
  of Edit) with a line saying who can change them; global rules read only for anyone who is not
  an org admin.
- Phone: trigger, depth and duration hide in the log; the builder becomes a full-screen sheet.

**URL state.** The view (`?view=runs`), the run filter (`?status=`), and the open rule
(`?rule=<id>` or `?rule=new`), so a reload reopens the builder on the same rule.

**Choices recorded.**

- Statuses and labels are picked by name, because a global rule runs in every project and each
  project has its own; the pickers offer this project's names and accept them.
- The run log's per-action outcomes sit in a details dialog behind a count ("2 of 3 done"), for
  the same reason as webhook deliveries: the table has no expandable rows.
- Global rules are listed on every project's Automation page rather than in workspace settings,
  so a project admin sees everything that may act on the project's issues in one place.
- A run's state is drawn as its icon and word in the signal ink (green check, red warning,
  neutral minus) rather than a `Badge`: `Badge` has no danger tone, and Work cannot use the
  shell's `StatePill`. Webhooks, inside the shell, use `StatePill`. One shared state pill in
  `packages/ui` would settle both; it is left for a system change.

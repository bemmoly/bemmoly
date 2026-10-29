# Interaction log

> The interaction **rules** (the twelve principles, the shortcut map and the notes every new
> screen needs) are in the design system: [`../system/interaction.md`](../system/interaction.md).
> This log is history and evidence: each screen's notes and the choices recorded while building
> it. Keep adding a section per new screen here.

How every screen behaves, not only how it looks. One section per screen: its primary job, the
top three actions, the keyboard map, and how each state looks (loading, empty, error, partial,
many items, no permission). Each stream adds its screens here before building them, and records
any choice it made where the review and the principles in the build brief pulled apart.

## Foundations

The primitives every screen is built from. They live in `packages/ui`; their values are tokens
(`src/tokens/motion.ts`, `src/tokens/interaction.ts`), so a screen never picks its own.

**Focus.** One ring: a 2px accent outline, 2px outside the element, on `:focus-visible` only,
so a mouse click never shows it and the keyboard always does. It is the `focus-ring` utility
(`focus-ring-inset` inside clipped lists and rows, `focus-ring-within` on a field wrapper).
Button, IconButton, menu items, Input, Textarea, Select, Tabs, SegmentedControl, Checkbox,
Switch and clickable table rows all carry it. A page never draws its own focus style.

**Hover and press.** `--hover` and `--press` are overlays (the ink at 4.5% and 7% in light
themes, white at 5% and 8% in dark), so a hovered row, menu item or ghost button looks the same
on any surface. Utilities: `bg-hover`, `bg-press`.

**Motion.** Things enter in 120 to 180ms with an ease-out (`--duration-base` 160ms for menus,
popovers and rows; `--duration-slow` 180ms for dialogs, panels and toasts) and leave in 100ms
(`--duration-exit`). Only transform and opacity animate. Menus scale from their trigger (from
above when they open upward), panels slide, toasts rise. Under `prefers-reduced-motion` every
duration is zero and code that waits on an exit does not wait.

**Tooltips.** Every icon-only button has one, naming the action and its shortcut
(`<Tooltip label="New issue" keys="C">`). It opens after 400ms of hover, at once on keyboard
focus, and at once when the pointer moves from one tooltip's trigger to the next within 300ms,
so scanning a toolbar is not a series of waits. Escape closes it. It never holds the only copy
of information.

**Keyboard hints.** `Kbd` draws a key or a chord: modifiers and arrows are drawn as icons
(⌘ on Apple platforms, "Ctrl" elsewhere), never as characters a font may not have.

**Toasts and Undo.** A reversible destructive action happens at once and shows a toast with
Undo for 6 seconds. The countdown pauses while the pointer is over the toast or focus is in it;
Escape dismisses the focused toast; choosing the action dismisses it. Errors use the same
toast with Retry. Only irreversible actions ask first.

**Time.** `RelativeTime` prints "3h ago" and shows the absolute date and time on hover and to
assistive tech; it is a `<time>` with a machine-readable `dateTime`.

**Skeletons.** `SkeletonRow`, `SkeletonCard` and `SkeletonHeader` have the final layout's
heights and gaps, so nothing shifts when data lands. A loading region is `aria-busy`.

**Menus.** A menu animates from its trigger, moves with the arrow keys, Home and End, chooses
with Enter or Space, and closes with Escape or Tab. Choosing an item or pressing Escape returns
focus to the trigger; Tab moves on, and a click elsewhere leaves focus where the click put it.
It fades out in 100ms.

**Choices recorded.** The review's `kit.css` uses 7px radii on buttons and nav rows and 11.5 and
12.5px text in places; the tokens follow its own foundations sheet instead (radii 4/6/8/12,
sizes 11 to 24 in seven steps), keeping its 2px for marks under 12px so an epic's square
swatch never reads as a label's dot. Where a kit colour fails contrast it is lifted the smallest step
that passes (ADR 0015).

- [Workspace settings](interaction/settings.md)
- [MCP sign-in](interaction/mcp-consent.md): the consent screen an MCP client opens, and Connected apps under Access tokens.
- [Dialogs](interaction/dialogs.md): the modal, Create issue, sprint, saved filter, link, project dialogs.
- [Setup wizard](interaction/setup.md)
- [Settings › AI and the wizard's AI step](interaction/settings-ai.md): turning AI on, providers, model roles, privacy, budget, prompts, the personal opt-out.
- [Issue page](interaction/issue.md)
- [Board and Backlog](interaction/board-backlog.md)
- [Roadmap](interaction/roadmap.md): epics and versions on a timeline, rescheduling, the forecast and its panel.
- [Pairing](interaction/pairing.md): who worked beside whom on a project, the matrix and the pair panel.
- [Reports](interaction/reports.md): sprint burndown, burnup, report and velocity; cumulative flow and created vs resolved.
- [Projects and project settings](interaction/projects-settings.md)
- [Settings › Work: the org defaults](interaction/settings-work.md): issue types, fields, workflow and board every project inherits until it overrides them.
- [Settings › Webhooks and project settings › Automation](interaction/webhooks-automation.md): outgoing webhooks, the signing secret, the delivery log, rules, the rule builder and the run log.
- [Shell](interaction/shell.md): the frame, sidebar and rail, header, global keys, palette, Home, Inbox, sign-in, boot, not found.
- [Integration](interaction/integration.md): choices made bringing the streams together, the token alias removal, what is left.
- [Docs: frame and tree](interaction/docs-frame.md): the space tree in the sidebar, focus mode, the one header, layouts, errors in the frame, AI gating.
- [Docs page](interaction/docs-page.md): page column, icon and cover, properties row, the right margin, history mode, presence, Share.
- [Docs: writing surface](interaction/docs-editor.md): selection bubble and ⌘K links, block handles, the / menu, code and table tools, the typing fade, issue embeds and Linked work.
- [Settings › Docs](interaction/settings-docs.md): org templates, their order, archive and restore, the read view and the editor.
- [Settings › Import](interaction/settings-import.md): the stepper, Connect, the project and space chooser (search, filters, select all, keys, Undo), the plan, the run and the wizard's short path.
- [Start page and product switcher](interaction/start-page.md): the suite's front door after sign-in, and the grid button in every shell.
- [Docs: file pages and folders](interaction/docs-kinds.md): a page that is one file, full bleed; folders in the tree and their contents view; Turn into.
- [Docs: around the page](interaction/docs-around.md): create in place, Docs home, space overview, trash, search, import and export, phone.

## Bemmoly Pipelines

Pipelines' own screens, each with its notes:
[For you](interaction/pipelines-for-you.md), [Release map](interaction/pipelines-map.md),
[Catalog](interaction/pipelines-catalog.md), [Application](interaction/pipelines-application.md),
[Runs and a run](interaction/pipelines-runs.md).

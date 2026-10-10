# Interaction log

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
- [Dialogs](interaction/dialogs.md): the modal, Create issue, sprint, saved filter, link, project dialogs.
- [Setup wizard](interaction/setup.md)
- [Issue page](interaction/issue.md)
- [Board and Backlog](interaction/board-backlog.md)
- [Projects and project settings](interaction/projects-settings.md)

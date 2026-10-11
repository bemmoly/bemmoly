# Layout

One frame, two page layouts, one scroll region. Every signed-in screen sits inside it.

## The frame

`AppFrame` from `@bemmoly/core-web` (mounted once by `apps/web`'s `app-shell.tsx`; screens never
mount it).

```
┌──────────── 240px ───────────┬───────────────────────────────────────────────┐
│ BrandBlock                   │ PageHeader, 52px, sticky                      │
│ Search (Mod+K)   New (C)     ├───────────────────────────────────────────────┤
│ Home · Inbox · My issues     │                                               │
│ Work: projects and views     │  the page's one scroll region                 │
│ Docs: spaces and pages       │  (full: the screen's panes; contained: 1040)  │
│ Settings · Help              │                                               │
│ Bemmoly 0.4.0 · What's new   │                                               │
│ person menu   · Appearance   │                                               │
└──────────────────────────────┴───────────────────────────────────────────────┘
```

| Part         | Size                         | Rule                                                        |
| ------------ | ---------------------------- | ----------------------------------------------------------- |
| Sidebar      | 240px (`w-60`), `bg-side`    | The only navigation. No global top bar, no second nav column |
| Rail         | 56px (`w-14`)                | `[` folds and unfolds it, remembered per person; automatic below 1100px (`NARROW`), where `[` unfolds the sidebar over the page |
| Header       | 52px (`h-13`), `bg-canvas`   | Breadcrumbs, view tabs, presence, actions. Sticks; never scrolls away |
| Phone sheet  | under 768px (`PHONE`)        | The sidebar becomes a sheet (280px, at most 85vw) behind the header's menu button; going somewhere closes it |
| Bottom bar   | under 768px                  | `BottomBar`: Home, Inbox, New, My issues, the first module's area |

- **Settings mode.** Under `/settings` the same sidebar lists the settings pages with
  "Back to app" and Esc at the top. There is no separate settings shell.
- **Standalone screens.** Only the setup wizard (no workspace exists yet) and the pages before
  sign-in (sign-in, reset, invitation, the first-sign-in welcome) sit outside the frame. They
  still use the tokens, icons, tiles and the Bemmoly lockup. The pages before sign-in share
  `AuthShell` (`apps/web/src/components/auth/auth-layout.tsx`, ADR 0022): a form column, 480px
  under 1300px wide and 520px above, and from 1100px the product panel in the workspace's theme;
  one column below, full-bleed on phones with `size="touch"` controls. The MCP consent screen
  (`/oauth/authorize`, ADR 0027) uses the same shell: it needs a session, but the person
  arrives from another app and leaves for it again.
- **Failure stays in the frame.** Not found, a thrown page and a module chunk that fails to load
  render inside the frame, so the sidebar is still the way on.
- **Phone.** Nothing scrolls the page sideways at 390px. The header keeps the current crumb;
  tabs and actions move to rows under it that scroll sideways.

## The page header

`PageLayout` draws `PageHeader` for you; pass its props as `header`.

```tsx
import { HeaderActions, PageLayout } from '@bemmoly/core-web';

<PageLayout
  layout="contained"
  header={{ crumbs: [{ label: 'Projects', path: '/work/projects' }] }}
>
  <HeaderActions>
    <Button variant="primary" onClick={create}>New project</Button>
  </HeaderActions>
  …
</PageLayout>
```

- `crumbs`: every crumb links, the current one included (`aria-current`). A crumb may carry an
  `icon` (a tile) or a `switcher` (the project crumb is a searchable switcher).
- `tabs` (`PageTab`: `id`, `label`, `icon`, `path`, `keys`): views of the same thing (Board,
  Backlog) or a settings area's sections. Never a second tab row under the header.
- Actions go through `<HeaderActions>` (portalled into the header, so it never moves while the
  screen loads); presence through `<HeaderPresence>` with `PresenceFacepile`.
- `useHeaderTrail` refines the trail's end once data arrives ("Auth service / PLT-204").
- Tab titles: `useDocumentTitle` gives "page · context · Bemmoly"; `PageLayout` derives it from
  the header when `title` is left out.

## Two page layouts

`PageLayout` `layout` is required and has exactly two values.

| Layout      | For                                                            | Shape                                                   |
| ----------- | -------------------------------------------------------------- | ------------------------------------------------------- |
| `full`      | Board, Backlog, Inbox, editors (workflow, board settings), Docs pages and trash | Full bleed, 24px gutters (`px-6`); the screen fills the height and scrolls its own panes |
| `contained` | Home, Projects, every settings page, the Issue page, Docs home and space overview | A 1040px reading column (`max-w-260`), 32px sides (16px on phones), the layout scrolls it |

Rules:

- **One scroll region per page, owned by the layout.** A `contained` page never adds
  `overflow-auto` around its content. A `full` screen scrolls panes (columns, lists, the peek),
  never the whole page plus a pane.
- **Headers stick.** Section headers inside a long list may stick too, under the page header.
- **No layout of your own.** No third width, no centred card on a grey page, no max width other
  than the column the layout gives you. Docs' page body is a 700px measure inside `full`
  (with #77, `page-frame.tsx`), the one recorded exception, because it is a document.
- **Dialogs** are `Modal`; under 640px every dialog is a full-screen sheet.

## Module sidebar contributions

A module draws into the same sidebar through its manifest (`defineModule` in `module.ts`, schema
`moduleManifestSchema` in `packages/shared/src/schemas/modules/manifest.ts`):

```ts
export default defineModule({
  id: 'work',
  icon: 'board',          // an icon name from @bemmoly/ui/icons
  color: 'brand-1',       // a token: brand-1/2/3, accent, epic-1…8. Never a hex
  order: 10,              // section order, lowest first
  sidebar: {
    path: '/work/projects',
    links: [{ id: 'work.all-projects', label: 'All projects', path: '/work/projects', icon: 'layers' }],
    primary: [{ id: 'work.my-issues', label: 'My issues', path: '/work/my-issues', icon: 'me' }],
    add: { create: 'work.create-project', label: 'New project' },
  },
  …
});
```

- **One top-level area per module.** One section, headed by the module's tile and name.
- **Live rows** (Work's projects, Docs' spaces) come from the module's `web/src/sidebar.tsx`,
  registered with `createSidebarRegistry` and drawn with `SidebarRow` and `SidebarHeading` from
  `@bemmoly/core-web`. It loads with the shell, never with a screen; until it lands, the section
  shows its heading and fixed `links`.
- `primary` rows join Home and Inbox and the phone's bottom bar. `add` is the heading's "+",
  opening the module's create in place.
- Navigation chords are `G` plus a letter (`keys: 'G B'` on a navigation entry); `G H` and `G I`
  belong to the shell.
- A module may take over the sidebar while it needs it (Docs' focus mode, `useSidebarTakeover`,
  with #77). The brand block, search, New and the foot stay. Never on the rail.

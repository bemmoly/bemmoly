---
'@bemmoly/ui': minor
'@bemmoly/core': minor
'@bemmoly/shared': minor
'@bemmoly/api-client': minor
'@bemmoly/web': minor
'@bemmoly/editor': minor
'@bemmoly/site': minor
---

Themes and modes. The eight presets become five themes, each designed in light **and** dark:
Bemmoly (the default, the logo's blue), Graphite, Sand, Pine and High contrast. Mode is now its own
choice: Light, Dark or Match system, which really follows the computer's setting, live. Each
person's mode is saved on their account and follows them to every device; the workspace sets the
default theme and the default mode (new workspaces follow the system). The typeface is a separate
setting. Admins can make a **custom theme** from one brand colour and a surface style: Bemmoly
builds checked light and dark versions, adjusts them until text and buttons pass contrast, warns
when the colour is close to one that already means something (errors, warnings, done, AI), and
never recolours the logo. A custom theme can be the workspace default, and when personal themes
are on, people can pick any theme, or make their own, from the user menu. In dark mode Task and
Epic tiles are lighter so they stay readable.

Upgrading changes nobody's look: Classic, Dark, Midnight, Ocean and Rose become Bemmoly in their
old mode, Slate becomes Graphite, Warm becomes Sand and Forest becomes Pine; each workspace keeps
its mode as the default mode and keeps its typeface. A custom brand colour becomes a workspace
custom theme. Choices saved in a browser move to the account on the next sign-in.

Admins: the schema adds the kernel changeset `0600-appearance-themes` (the `custom_themes` and
`user_appearance_preferences` tables, and a rewrite of the stored `appearance.*` settings). It is
reversible and quick. New settings: `appearance.defaultMode` and `appearance.customThemeId`.
`appearance.mode`, `appearance.surfaces` and `appearance.memberModeSwitch` are no longer used and
will be removed in a later release. New endpoints: `GET`/`PUT /api/v1/me/appearance` and
`/api/v1/themes`. The demo takes `?theme=pine&mode=dark`.

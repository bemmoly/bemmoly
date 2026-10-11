---
'@bemmoly/core': minor
'@bemmoly/shared': patch
'@bemmoly/web': minor
---

Appearance moves out of the sidebar's person menu into a small Appearance button beside your
name (stacked above your avatar on the collapsed rail). It offers Light, Dark and Match system.

Only a workspace admin now sets the theme. Personal themes are retired: `PUT /me/appearance`
refuses a theme with 403 and stores only the mode, a personal theme saved before is ignored, and
personal custom themes can no longer be created. In Settings › Appearance, people who are not
admins see the workspace theme read-only beside their own mode. The "Let people pick their own
theme" switch is gone; `appearance.personalThemes` is now inert and always reported as false.
No schema change.

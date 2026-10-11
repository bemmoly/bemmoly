---
'@bemmoly/module-docs': minor
'@bemmoly/web': minor
---

Org admins can now manage the templates every space offers in Settings › Docs. The page lists
the org-wide templates with how many pages each started and who added it, searches them, sets
the order the template picker shows, archives a template with Undo (it leaves every picker until
restored) and restores archived ones. A template opens a preview of its body and the fields its
page form asks for; custom templates edit in place, with a name, description, category, icon,
fields and body. The six built-in templates are now read only: they can be ordered, archived or
duplicated into an editable copy, and edits an install made to them before this release are
kept. Spaces keep their own templates.

A new Docs permission, "Manage org templates" (`docs.templates.manage`), on for org admins only
by default, gates these changes; anyone else gets a 403. Org templates were previously changed
under "Manage workspace settings". No configuration or schema change.

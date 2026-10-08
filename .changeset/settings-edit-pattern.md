---
'@bemmoly/ui': patch
'@bemmoly/web': patch
'@bemmoly/api-client': patch
---

Settings pages no longer let a stray click change something. Storage and backups, Updates, Email
and notifications and Workspace details open showing your current values; each section has an
Edit button, and Save stays off until you change something. Changes that can lose backups or
stop people working (lowering retention, removing the backup bucket, turning off local
encryption, switching the update channel, sending email to the dev mailbox) say what will happen
before they are saved, and the riskiest ask you to type a word to confirm. If you leave a page or
have two sections open with unsaved changes, a bar at the bottom says so.

Restoring a backup is easier to find: every backup that can be restored has a Restore button, a
Restore… button at the top of Storage and backups lets you pick one, and the confirmation explains
maintenance mode, what is replaced and the fallback copy kept of your current data. The backups
table scrolls sideways on narrow screens instead of cutting off its buttons.

The top bar no longer shows arrows on links that do not open a menu. Create opens a clear menu of
what you can make, or explains that it fills once a module is enabled, with a link to Settings ›
Modules for admins. Icons across the app are clearer, including real Inbox and theme icons in the
top bar, and dropdown arrows are larger and darken while open. The Team filter in Settings › Users
can be searched, and abandoned people searches stop instead of finishing in the background.

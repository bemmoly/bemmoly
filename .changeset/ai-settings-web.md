---
'@bemmoly/web': minor
'@bemmoly/api-client': minor
'@bemmoly/e2e': patch
---

Settings › AI and models is rebuilt on the AI runtime. One switch turns AI on or off for the
whole workspace. Turned off, every AI surface disappears for everyone, and the providers and
roles are kept for when it is turned back on. While AI is on, the page has four sections:

- **Setup.** Connected providers show their status and each has Test and Remove. Add provider
  opens the Popular row and the whole catalog with logos, searchable. The form comes from the
  catalog entry: keys are write-only, the base URL is filled in and the provider's docs are
  linked. A Local server asks for a protocol, an address and an optional key, then lists its
  models. Test connection reports success or the provider's own error in plain words. Each role
  (fast, standard, strong, embedding) picks from the models that qualify, with capability
  badges, context size, price per million tokens and release date. A newly connected provider
  fills every empty role with its suggested model. The catalog's status line, the live-fetch
  switch and catalog upload sit below.
- **Privacy.** Choose what is sent: content, and email addresses and names (which can be
  hidden). Exclude spaces and projects by name. Choose whether AI actions may change data and
  whether people may turn AI off for themselves. Each switch applies at once and can be undone.
- **Usage.** Set the monthly budget. This month's spend is shown by role, purpose and model, and
  the page explains in plain words what happens at 80% and 100%.
- **Prompts.** Every shipped prompt is listed. An override can be edited, compared with the
  default line by line, and reset.

The setup wizard's AI step uses the same catalog, connection form, test and roles, and offers
"Skip, no AI". Profile gains "Use AI features" when the admin allows people to opt out.
`useWorkspace().aiEnabled` follows an admin's change without a reload. A member can open
Profile and Notifications again; the settings guard had made them admin-only. The public demo
shows AI on with a configured provider and makes no network calls.

---
'@bemmoly/core': patch
'@bemmoly/shared': patch
'@bemmoly/web': patch
---

Settings › Roles no longer lists "Manage billing and license". Nothing ever checked it, and
Bemmoly has nothing to buy. Schema: the kernel changeset `0109-identity-drop-billing-capability`
deletes the stored grants of `workspace.billing.manage` on update; it is quick and reversible.

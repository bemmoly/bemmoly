---
'@bemmoly/server': minor
'@bemmoly/core': minor
'@bemmoly/shared': minor
'@bemmoly/web': minor
'@bemmoly/module-docs': minor
'@bemmoly/module-work': minor
---

A link to a page or an issue pasted into WhatsApp, Slack or any other chat app now previews with
its title ("PLT-204 Fix login", "Cache plan") and the workspace's name, instead of a generic
"Bemmoly". Chat apps fetch the link signed out, so anyone holding it sees the title, never the
content. It is on by default; admins can turn it off under Settings › General › Sharing (the new
`workspace.linkPreviews` setting). No schema change.

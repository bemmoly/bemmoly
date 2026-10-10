---
'@bemmoly/core': patch
---

Provider logos from the catalog are checked more strictly before they are served. A logo is refused
if it links out, loads anything from another address, animates its links, or hides a scheme behind
character references. Logos that only draw, or carry an embedded picture, are kept.

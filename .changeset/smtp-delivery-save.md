---
'@bemmoly/web': patch
---

Saving Delivery on Settings › Email delivery works again before a From address is set. Each
section is now checked on its own, so a field left unset in the closed Sender section no longer
stops Delivery from saving without a word. Port and Security also follow each other: a usual
port (465, 587 or 25) picks its security, and picking TLS or STARTTLS moves a usual port to its
own. A custom port, like 2525, is left as typed.

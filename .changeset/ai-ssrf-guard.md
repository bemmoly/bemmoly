---
'@bemmoly/core': patch
---

AI providers are now checked at call time, not only when they are saved. Each model call and Local
server lookup checks the address it is about to reach, and a provider that answers with a redirect
is refused instead of followed. A Local server may still use loopback and your private network, but
never a link-local address, where cloud metadata services answer. `BEMMOLY_ALLOW_PRIVATE_URLS=true`
still lifts all of this.

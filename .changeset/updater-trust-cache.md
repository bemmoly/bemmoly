---
'@bemmoly/updater': patch
---

Fix in-app updates failing at the verify step with "mkdir /root/.sigstore: read-only file system". The updater runs on a read-only filesystem, and the signature check could not cache Sigstore's trust root. It now caches it in /tmp. Installs on 0.1.6 or older update once with `sudo bemmoly upgrade` to get the fixed updater; from then on, Update in Settings › Updates works.

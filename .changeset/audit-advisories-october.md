---
'@bemmoly/server': patch
'@bemmoly/core': patch
'@bemmoly/shared': patch
---

The server ships with patched releases of three libraries that had high severity denial of
service advisories: zod 4.6.6 (validation of oversized collections could exhaust memory),
body-parser 2.4.0 under the MCP endpoint (trailing bytes after a compressed body) and undici
7.30.1 under the AI providers (excessive content encodings). No schema or configuration change.

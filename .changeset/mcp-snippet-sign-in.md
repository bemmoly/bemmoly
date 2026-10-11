---
'@bemmoly/web': patch
---

Settings › MCP server now gives a client configuration with only the address, so clients sign in
through the browser on first connect. The configuration with an access token stays below it, for
CI, scripts and clients that can't open a browser.

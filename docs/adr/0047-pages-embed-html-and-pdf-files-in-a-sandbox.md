# ADR 0047: Pages embed HTML and PDF files, HTML in a sandbox with an origin of its own

- Status: accepted
- Date: 2026-10-20
- Changes: the kernel's files API (`packages/core/src/services/files`), which took images
  only and served every file under `default-src 'none'; sandbox`; adds the File block and the full-screen
  viewer to the design system (`components-work-docs.md`, File block)
- Evidence: agent output, which is more and more a single HTML file (a report with charts
  from a CDN, tabs, a table) or a PDF; the browsers' iframe sandbox and CSP `sandbox`
  directive; how hosted artifact viewers isolate untrusted HTML

## Context

Agents write pages through MCP, and what they produce is often not Markdown: it is one HTML
file that draws its own charts, or a PDF. People want it in the page, between paragraphs,
small enough to read past and one click from full screen. Pages took only images.

HTML is code. Opened on Bemmoly's origin it would run as the person reading it: call the API
with their session, read what the page shows, and draw over the app. A plain iframe on the
same origin changes none of that.

## Decision

1. **The files API takes PDF and HTML, for targets that opt in.** `FileTargetDefinition`
   gains `accepts`; a target that leaves it out still takes images only. Docs pages take all
   six types. The bytes decide what a file is: `%PDF-` is a PDF; UTF-8 text that opens as
   `<!doctype html>` or `<html>`, or text with markup sent under an `.html` name, is HTML. A
   bare SVG is still refused, since it is drawn by `<img>` where no sandbox reaches.
2. **HTML runs in a sandbox with an origin of its own.** It is served with
   `Content-Security-Policy: sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox`
   (never `allow-same-origin`), and the editor frames it with the same `sandbox` attribute.
   The document gets an opaque origin: its requests to Bemmoly are cross-site, so the
   `SameSite=Lax` session cookie is not sent and CORS hides any answer; it cannot reach the
   page around it, navigate the app or submit forms. HTML is drawn inline only when a frame
   asks for it (`Sec-Fetch-Dest: iframe`); opened on its own, or by a client that does not
   say, it is sent as an attachment, so a file is never a page under Bemmoly's name. Links
   inside it may open new tabs outside the sandbox (`allow-popups-to-escape-sandbox`): such a
   tab can reach only the frame that opened it, and outside sites work there.
3. **It may load from the web but never send.** `script-src`, `style-src`, `font-src`,
   `img-src` and `media-src` allow `https:` (and inline code), so CDN chart libraries and web
   fonts work; `connect-src 'none'` and `form-action 'none'` shut `fetch`, XHR, WebSockets,
   beacons and forms. A remote image or script still tells its server that the file was
   opened; an install that cannot accept that keeps documents out of its pages.
4. **Only Bemmoly frames them.** HTML and PDF are served with `X-Frame-Options: SAMEORIGIN`
   and `frame-ancestors 'self'`; images keep `default-src 'none'; sandbox`. A PDF is not
   sandboxed (browsers refuse to draw one in a sandbox) and runs in the browser's own viewer.
5. **The frame says what it is.** The File block always shows the file's name and kind above
   the frame, inside and outside full screen, so an HTML form that imitates a sign-in is
   never mistaken for the app. Frames load when scrolled near and are dropped when the viewer
   closes.

## Consequences

- Agents attach a file with `docs_upload_file` and place it with Markdown image syntax; the
  server turns a link to a stored PDF or HTML file into a File block.
- Exports print a File block as a link to the file; print and Markdown never inline it.
- A PDF opened on its own still shows under Bemmoly's address, in the browser's viewer; its
  scripts run in that viewer, never as Bemmoly's origin.
- A separate origin for user content (a second host name) would be stronger still; self-hosted
  installs rarely have one, so the CSP sandbox and the framed-only rule are the line. Revisit
  if installs gain a content host.

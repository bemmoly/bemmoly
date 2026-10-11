# ADR 0034: PDF export through an optional renderer, the print view without it

- Status: accepted
- Date: 2026-10-11
- Changes: tech design §15 "Exports and imports" ("PDF via headless Chromium in a worker,
  optional"), which named the engine but not where it runs, how it is reached, or what people
  see when it is absent; adds print tokens to the design system (`tokens.md`, Print)
- Evidence: the Docs export dialog, which until now offered PDF only through the browser's
  "Save as PDF"; Gotenberg 8.37.0 (`gotenberg/gotenberg:8.37.0-chromium`), its configuration
  reference

## Context

People export Docs pages to share outside the app, and a PDF with page numbers, a running
title and a table of contents is what they ask for. Chromium is the only engine that prints
our HTML faithfully, but it is about 500 MB and a large attack surface: putting it in the app
image would triple the image for every install, most of which never print.

The browser's own print view already works on every install: the export dialog writes the
page's self-contained HTML into a hidden frame and prints it. It cannot add page numbers or a
running header reliably, cannot print a subtree as one document, and leaves the paper size to
the person's print settings.

## Decision

1. **The renderer is an optional component, not part of the app image.** A pinned
   `gotenberg/gotenberg:8.37.0-chromium` (by digest) runs as the `pdf` service: a Compose
   profile, `pdf.enabled` in the Helm chart, and an optional image in the air-gap bundle. The
   app reaches it through `createPdfRendererClient` in `packages/core/src/clients` with a timeout
   on every call, and modules see it as `ctx.pdf`, present only when `BEMMOLY_PDF_URL` is set.
2. **The app sends everything; the renderer fetches nothing.** The Docs service builds one
   print document (`toPrintDocument` in `@bemmoly/editor/convert`) with its stylesheet inline
   and every uploaded image the person may read embedded as a `data:` URI, read through the
   kernel's files service with the person's own access checks. The renderer starts with every
   host name unresolvable (`--chromium-host-resolver-rules=MAP * ~NOTFOUND`), every URL but
   `data:` and its own temp folder refused, JavaScript off, and sits on a network with no
   route out. A page that names an external image prints its alt text instead.
3. **Chromium is sandboxed by its container.** The service runs as Gotenberg's non-root user
   with a read-only root file system, every Linux capability dropped, `no-new-privileges`, a
   memory and process limit, and a `tmpfs` for its scratch space. The renderer limits each
   request (`--api-timeout`), restarts Chromium after a number of renders, and keeps a short
   queue; the app limits the HTML it sends and the PDF it keeps (`BEMMOLY_PDF_MAX_BYTES`,
   `BEMMOLY_PDF_TIMEOUT_MS`).
4. **Rendering is a job.** `POST /api/v1/docs/pages/:pageId/exports` queues `docs.export-pdf`
   with an idempotency key (the request's, or a hash of the page, scope, paper and the page's
   last change), so a double click renders once. The PDF is kept in `page_exports` for 24
   hours and downloaded from `GET /api/v1/docs/exports/:exportId/file` by the person who asked.
   The dialog waits for a single page and downloads it; a subtree, or a page that takes longer,
   also sends a `docs.export_ready` notification with the link.
5. **Without the renderer, the simplest honest option.** The More menu's "Export as PDF" is
   not shown. The export dialog keeps its PDF choice as it was: "Through your browser's Save as
   PDF", one page, using the same print document and stylesheet, so the paper reads the same
   apart from the header and footer the browser draws. No button ever promises a file the
   install cannot make.
6. **Print has its own tokens.** `PRINT_TYPE`, `PRINT_LEADING`, `PRINT_SPACE`,
   `PRINT_MARGINS` and `PRINT_PAPERS` in `@bemmoly/ui/tokens`, in points and millimetres;
   colours are the Classic light theme's.

## Consequences

- The app image is unchanged in size; an install that wants server PDFs pulls one more image.
- The PDF bytes live in Postgres for a day. `BEMMOLY_PDF_MAX_BYTES` (50 MiB by default) bounds
  one row, and the hourly docs.purge-exports job removes expired rows.
- Gotenberg runs Chromium inside its container without Chromium's own setuid sandbox, as
  containerised Chromium usually does; isolation is the container's and the network's. An
  operator who wants more can run the service under gVisor or a stricter seccomp profile.

## Alternatives

- **Chromium in the app image** (Puppeteer in a worker): rejected for image size and attack
  surface on every install.
- **Our own renderer image** (Node and Puppeteer): more code to patch and pin than a maintained
  single-purpose image with the network controls we need already built in.
- **Hide PDF entirely without the renderer**: the print view already works and is honest about
  what it does, so removing it would take away something people use.
- **A pure-JavaScript PDF writer**: would mean a second layout engine to keep in step with the
  HTML export.

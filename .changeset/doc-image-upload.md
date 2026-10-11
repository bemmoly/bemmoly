---
'@bemmoly/core': minor
'@bemmoly/shared': minor
'@bemmoly/api-client': minor
'@bemmoly/editor': minor
'@bemmoly/module-docs': minor
'@bemmoly/web': minor
'@bemmoly/server': minor
---

Images go into Docs pages by upload, not only by link. Paste a screenshot, drop a file, or pick
Image from the / menu: the image uploads with its progress shown where it will land, a failed
upload says why and offers Try again, and everyone else on the page sees it arrive live. A
selected image's alt text is edited in place.

Images are stored by Bemmoly as files of the page: people who can edit the page add them, people
who can read it see them, and nobody else can open them. PNG, JPEG, GIF and WebP are accepted,
checked by their content rather than their name; SVG is refused. Uploaded images are kept under
the data directory's attachments folder, so backups include them, and an image no page, version
or template refers to any more is removed after a day by the housekeeping job. A page exported
as HTML carries its images inside it, a page and its children exported as a folder carry them in
an `images/` folder, and a single Markdown file keeps links to them.

Configuration: `BEMMOLY_UPLOAD_MAX_BYTES` sets the largest upload (10 MiB by default) and
`BEMMOLY_RATE_LIMIT_UPLOADS_PER_USER` the uploads a person may make per minute (30 by default).
Schema: kernel changeset `0500-files` adds the `files` table (additive, fast).

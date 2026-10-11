# Bemmoly launch posts

Final copy for the public launch, written against Bemmoly 0.12.0, the newest published release.
Every claim here is in a published release note or the README; nothing below is planned work
described as shipped. Images for each post are in [images/](images/) and on the review page,
[index.html](index.html).

Facts these posts rely on:

- Version 0.12.0. MIT. Self-hosted: one Docker image and one Postgres.
- Work: projects, custom workflows, Kanban and Scrum boards, backlog and sprints, a query
  language and saved filters.
- Docs: spaces, a page tree, a real-time collaborative editor, revisions, comments, image
  uploads, live issue links.
- Optional AI: off until an admin turns it on; your own provider or a model on your network;
  summaries that cite their sources, answers from your docs, help in the editor.
- Import from Jira, Confluence or CSV (0.7.0). Single sign-on with OIDC or SAML, and SCIM
  (0.7.0). A built-in MCP server (0.6.0). Five themes in light and dark, a custom theme from one
  brand colour (0.8.0), and a workspace logo (0.9.0).
- Operations: automatic HTTPS, nightly verified backups, updates from the app with automatic
  rollback, signed images. No telemetry.
- Coming soon (no dates): webhooks and automation, a roadmap view, Kubernetes (Helm) and
  Terraform.

Links:

- Live demo: https://bemmoly.com/demo
- Install: https://bemmoly.com/self-hosting#install, or `curl -fsSL https://get.bemmoly.com | sh`
- Feedback and ideas: https://github.com/bemmoly/bemmoly/discussions
- Bugs: https://github.com/bemmoly/bemmoly/issues
- Optional support, unlocks nothing: https://buymeacoffee.com/bemmoly

---

## Show HN

Image: none.

**Title:** Show HN: Bemmoly – self-hosted issues and docs, MIT, no paid tier

**URL:** https://github.com/bemmoly/bemmoly

**First comment:**

Hi HN, I'm Keerthi. Bemmoly is a self-hosted app for a team's issues and docs: boards, a
backlog and sprints, and docs pages that sit next to the issues they explain. It's one Docker
image and one Postgres, and one command installs it:

    curl -fsSL https://get.bemmoly.com | sh

(or read the script first: `curl -fsSL https://get.bemmoly.com -o install.sh`)

You can try it without installing at https://bemmoly.com/demo. That's the real app on sample
data, running in your browser against a mocked backend.

Three promises: 100% open source (MIT, no open core, no enterprise edition), no pricing (no
seats, plans or licence key), and no in-app purchases (nothing is locked).

What's in 0.12.0:

- Work: projects, custom workflows, Kanban and Scrum boards, backlog and sprints, a query
  language and saved filters.
- Docs: spaces, a page tree, a real-time collaborative editor, revisions, comments, image
  uploads and live issue links.
- Import from Jira, Confluence or CSV, with a preview of what lands before anything is written.
- Single sign-on (OIDC, SAML) and SCIM provisioning, at no extra cost, because there is no cost.
- AI, optional: off until an admin turns it on. Use your own provider or a model on your own
  network. Summaries cite their sources, and admins choose what content is sent.
- A built-in MCP server, so agents and IDEs can work in your workspace with your permissions.
- Operations: automatic HTTPS, nightly verified backups, updates from the app that roll back on
  their own if the new version isn't healthy, signed images, no telemetry.

Not there yet: webhooks and automation, a roadmap view, and a supported Helm chart and Terraform
modules.

It's a young project and I'd value blunt feedback, especially on installing it on your distro
and on what's missing before you'd move a team over. Ideas and questions:
https://github.com/bemmoly/bemmoly/discussions. Bugs:
https://github.com/bemmoly/bemmoly/issues.

Stack: TypeScript, Fastify, React, and Postgres (with pgvector) as the only datastore.

---

## r/selfhosted

Image: `images/reddit-selfhosted.png` (1920 × 1080).

**Title:** Bemmoly: self-hosted issues and docs in one Docker image and one Postgres (MIT, no paid tier, optional AI with your own provider)

**Body:**

I've been building Bemmoly, a self-hosted place for a team's issues and docs. It's at 0.12.0
and I'm opening it up today.

**Try it first:** https://bemmoly.com/demo is the real app on sample data, in your browser.

**Install** on a VM with a domain pointing at it:

    curl -fsSL https://get.bemmoly.com | sh

The installer sets up Docker, Postgres with pgvector, Caddy with automatic HTTPS, nightly
backups with a weekly verification, and the updater. Prefer to wire it yourself? There's a plain
Docker Compose file, and it can use an existing Postgres. Full guide:
https://bemmoly.com/self-hosting#install

**What's in it**

- Work: boards, backlog, sprints, custom workflows, filters
- Docs: collaborative editor, page tree, revisions, comments, image uploads
- Import from Jira, Confluence or CSV
- SSO (OIDC, SAML) and SCIM, not behind a paywall, because there isn't one
- AI, **optional and off by default**: your own provider key or a local model server
- Updates from inside the app, signed images (cosign), automatic rollback on a failed health
  check
- Five themes in light and dark, and your own logo

**Promises:** 100% open source (MIT), no pricing, no in-app purchases. No telemetry.

**Not there yet:** webhooks and automation, a roadmap view, a supported Helm chart and
Terraform. Keep the backups it makes.

Repo: https://github.com/bemmoly/bemmoly. Feature ideas and "here's how I'd run it" go to
Discussions (https://github.com/bemmoly/bemmoly/discussions); "it broke on my distro" goes to
Issues (https://github.com/bemmoly/bemmoly/issues). Both are very welcome.

---

## Product Hunt

Images: `images/producthunt-thumbnail.png` (240 × 240) and the gallery
`images/producthunt-1-promise.png` to `images/producthunt-6-themes.png` (1270 × 760), in order.

**Name:** Bemmoly

**Tagline** (56 of 60 characters):

Self-hosted issues and docs. Open source, nothing to buy

**Description** (252 of 260 characters):

Your team's issues and docs in one app on your own server: boards, sprints, a collaborative
editor, Jira and Confluence import, and optional AI with your own provider. MIT, no pricing, no
in-app purchases. Try the live demo or install with one command.

**First comment (maker):**

Hi Product Hunt, I'm Keerthi. I made Bemmoly because I wanted our issues and specs in one place
we own: our server, our Postgres, our backups.

What's in it today (0.12.0):

- Work: Kanban and Scrum boards, backlog, sprints, custom workflows
- Docs: real-time editor, page tree, revisions, comments, live issue links
- Import from Jira, Confluence or CSV, and SSO with SCIM included
- AI, optional: off until you turn it on. Your provider or a local model. Summaries cite their
  sources.

Three promises: 100% open source (MIT), no pricing, no in-app purchases.

Try the demo, no sign-up: https://bemmoly.com/demo
Install: https://bemmoly.com/self-hosting#install

It's young, and the roadmap is shaped by what people ask for. Tell me what's missing in
GitHub Discussions (https://github.com/bemmoly/bemmoly/discussions), or file a bug in GitHub
issues (https://github.com/bemmoly/bemmoly/issues). If you'd like to support the work, there's
an optional Buy me a coffee (https://buymeacoffee.com/bemmoly); it unlocks nothing, because
nothing is locked.

---

## X thread

Images: post 1 `images/x-post-1-hero.png`, post 3 `images/x-post-2-docs.png`, post 4
`images/x-post-3-ai.png` (1600 × 900). Profile header: `packages/ui/assets/brand/generated/x-header-UPLOAD-3000x1000.png` (upload; 1500 × 500 display).

**1/7**
Bemmoly is out: self-hosted issues and docs for your whole team.

100% open source. No pricing. No in-app purchases.

One Docker image, one Postgres, one command.

**2/7**
Work: Kanban and Scrum boards, backlog, sprints, custom workflows and a query language.

Docs: a real-time editor with a page tree, revisions, comments and live issue links.

Same app, same sidebar.

**3/7**
Moving over? Import from Jira, Confluence or CSV, and see what will land before anything is
written.

SSO (OIDC, SAML) and SCIM are included. There's no enterprise tier to put them in.

**4/7**
AI is optional and off until an admin turns it on.

Bring your own provider or a model on your network. Summaries cite the comments, issues and
pages they came from.

**5/7**
Self-hosting is the point: automatic HTTPS, nightly verified backups, updates from the app that
roll back if unhealthy, signed images, no telemetry.

curl -fsSL https://get.bemmoly.com | sh

**6/7**
Try it in your browser, no sign-up: https://bemmoly.com/demo
Install guide: https://bemmoly.com/self-hosting#install
Code (MIT): https://github.com/bemmoly/bemmoly

**7/7**
It's young, and I want to hear what's missing.
Ideas: https://github.com/bemmoly/bemmoly/discussions
Bugs: https://github.com/bemmoly/bemmoly/issues

Optional support, unlocks nothing: https://buymeacoffee.com/bemmoly

---

## LinkedIn

Image: `images/linkedin-post.png` (1200 × 627), or `images/linkedin-square.png`
(1200 × 1200). Company page cover: `packages/ui/assets/brand/generated/linkedin-cover-UPLOAD-4200x700.png` (upload; shown at 1128 × 191).

**Post:**

Today I'm opening up Bemmoly, an open source (MIT) app for a team's issues and docs that runs on
your own server.

It has boards, a backlog and sprints, a collaborative docs editor with live issue links, and
optional AI that uses the provider you choose and stays off until an admin turns it on. Teams
coming from Jira and Confluence can import their projects and spaces, and single sign-on is
included.

Three promises: 100% open source, no pricing, no in-app purchases. The only cost is the server
you run it on.

Try the live demo in your browser: https://bemmoly.com/demo
Install it with one command: https://bemmoly.com/self-hosting#install

It's a young project. Webhooks, automation and a roadmap view are coming next, and I'd like
your feedback to shape what follows: share ideas in GitHub Discussions
(https://github.com/bemmoly/bemmoly/discussions) or report a bug in GitHub issues
(https://github.com/bemmoly/bemmoly/issues).

#opensource #selfhosted #projectmanagement

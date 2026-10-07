# Bemmoly

**Your work. Your platform.**

Open source, self-hosted, AI-first issues and docs for your whole company.
One app image, one Postgres, deployed in five minutes, free forever.

Status: the workspace skeleton exists: kernel module contract, Fastify host, React shell, design
tokens and CI. No product features yet. Run it with Node 24 and pnpm 11:

```sh
pnpm i
pnpm dev    # Postgres 18 in Docker (if a daemon is running), server on :8080, web on :5173
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the checks to run before a pull request.

- Technical design: [docs/tech-design.html](docs/tech-design.html) (open in a browser)
- Product design mocks: [docs/design/mocks](docs/design/mocks) (14 linked screens, open `Bemmoly App.dc.html`)
- Foundation release plan: [docs/plan/foundation.md](docs/plan/foundation.md)

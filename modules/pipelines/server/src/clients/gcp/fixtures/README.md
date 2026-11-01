# Recorded Google Cloud answers

The tests replay these files through `server/src/testing/gcp-replay.ts`, so nothing reaches
the network. Every file says where it came from in its `recorded` field. Today all of them are
**hand-written** from Google's REST reference: the shapes and field names follow the public
docs, but no real organisation answered them. A test that passes against them proves the code
handles the documented shapes, not that Google answers that way.

## Capturing real ones from a sandbox

You need a sandbox organisation where `deploy/gcp/bootstrap.sh` has run, and your own gcloud
sign-in holding the roles it grants (or run Bemmoly's control identity). Then:

```sh
gcloud auth application-default login
```

```sh
pnpm --filter @bemmoly/module-pipelines capture:gcp --folder <folder id> \
  --billing <billing account> --control-project <control project> --out /tmp/captured-gcp
```

It writes `managed-check.json`, `managed-billing.json` and `managed-read.json` and changes
nothing. Add `--apply` to create a Starter landing zone for real (two projects billed to the
account) and write `managed-apply.json`; delete those projects afterwards.

Request headers are never kept and tokens in answers are replaced with `redacted`, but read
each file before committing it: project numbers, emails and billing account IDs end up in
them. Replace an organisation's real IDs with the ones the tests use, or update the tests.

## Replacing a hand-written file

1. Capture as above, against the same calls the test makes.
2. Keep the order of exchanges: the replay uses each answer once, in order, unless it is
   marked `"repeat": true` (token lookups are).
3. Change `recorded` to say when and how it was captured, and run the tests. A request the
   file has no answer for fails the test with the request it saw.

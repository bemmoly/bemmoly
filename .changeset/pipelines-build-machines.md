---
'@bemmoly/module-pipelines': minor
'@bemmoly/pipelines-web': minor
'@bemmoly/runner': minor
---

A runner pool can run on Google Cloud Build. In Platform › Capacity, add a pool or change where
one runs, choose Google Cloud Build, and name its project, region, runner image, build service
account, machine type and most builds at once. When a job waits in the pool, Pipelines starts one
build for it: the runner image in one-job mode, registering with a token that works once for
that job. Cancelling the run cancels the build, a build that ends before its job reports fails
the job with Google's reason, and an idle pool runs nothing. Builds now shows every build still
running with its log, and a job links the build it ran on. Pull requests from forks never start
a build. The runner gains `--launch-token` and `--volumes-from`, and its image a `cloud-build`
target. A pool can now switch between machines you start and Cloud Build.

`PATCH /api/v1/pipelines/pools/:key` takes `hosting` and `cloudBuild`, and `POST /pools` takes
`cloudBuild`. The runner protocol's `POST /register` takes a `launchToken` in place of a
`poolToken`. Schema changeset `0023-pipelines-build-machines` adds the
`pipeline_runner_launches` table, two columns to runner pools and one each to jobs and runners; it is
quick and reversible.

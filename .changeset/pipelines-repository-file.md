---
'@bemmoly/module-pipelines': minor
'@bemmoly/pipelines-web': minor
'@bemmoly/runner': minor
---

Monorepos can describe every application in one file. An optional `.bemmoly/repository.yaml`
at the repository root holds `defaults` (build, paths, pipeline, labels, group, owner) and an
optional central list of applications, each with a name, a folder and any field
`application.yaml` takes. A folder's own `application.yaml` beats its entry in the list, which
beats the defaults; lists such as `paths` and `labels` add up and anything else is replaced.
Leaving the list archives an application, the way deleting its file does. An error names the
file and the field.

Builds take args: `pipeline.build.args` maps names to values that may use
`${{ app.name }}`, `${{ app.path }}` and the run's inputs. The runner passes each as a quoted
`--build-arg`, on Docker and on Kaniko in Autopilot pools. Build args stay in the image
history, so an arg named like a secret never takes a value from outside the file.

A push in one application's folder now always wakes it, and a push touching only a shared
path from the defaults wakes every application that lists it. An application whose pipeline
neither builds nor deploys is a library: it is checked and makes no release, and its page
says so. Each application's page shows where its settings come from. Discovery proposes one
repository file for folders that share a Dockerfile, picked by an ARG or by a compose file,
and Set up shows it before the pull request opens.

Schema change 0027 adds `pipeline_applications.settings_sources` and
`pipeline_discovery_proposals.shared_build`, both nullable. Runners older than this release
ignore build args, so update runners before relying on them.

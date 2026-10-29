# Cloud Build pools start one build per job, running the runner image for that job, and
# leave nothing behind to import. These are the settings each pool starts builds with.
locals {
  cloud_build_pools = {
    cloud_build = {
      image           = "us-docker.pkg.dev/acme-ci-7f3a/bemmoly/runner:1"
      machine         = "e2-highcpu-8"
      project         = "acme-ci-7f3a"
      region          = "us-central1"
      service_account = "builder@acme-ci-7f3a.iam.gserviceaccount.com"
    }
  }
}

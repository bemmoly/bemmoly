# The Cloud Run service of each application in each environment, at its serving release.
# Revision history and canary weights are left out; traffic is ignored, so set it here
# when you take over releasing.

# checkout-api in prod: release v1.43.0.
resource "google_cloud_run_v2_service" "checkout_api_prod" {
  project  = google_project.acme_prod_7f3a.project_id
  location = "us-central1"
  name     = "checkout-api"
  template {
    revision        = "checkout-api-v1-43-0-a1c9e3f"
    service_account = google_service_account.acme_prod_7f3a_runtime.email
    containers {
      image = "us-central1-docker.pkg.dev/bemmoly-control-583920174411/apps/checkout-api@sha256:4f1c2a9e0b7d6c5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e"
      ports {
        container_port = 8080
      }
      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }
      startup_probe {
        timeout_seconds = 5
        period_seconds  = 10
        http_get {
          path = "/healthz"
        }
      }
      env {
        name = "DB_URL"
        value_source {
          secret_key_ref {
            secret  = "bemmoly-checkout-api-DB_URL-prod"
            version = "3"
          }
        }
      }
      env {
        name  = "LOG_LEVEL"
        value = "info"
      }
    }
  }
  traffic {
    type     = "TRAFFIC_TARGET_ALLOCATION_TYPE_REVISION"
    revision = "checkout-api-v1-43-0-a1c9e3f"
    percent  = 100
  }
  lifecycle {
    ignore_changes = [traffic]
  }
}

resource "google_cloud_run_v2_service_iam_member" "checkout_api_prod_public" {
  project  = google_cloud_run_v2_service.checkout_api_prod.project
  location = google_cloud_run_v2_service.checkout_api_prod.location
  name     = google_cloud_run_v2_service.checkout_api_prod.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

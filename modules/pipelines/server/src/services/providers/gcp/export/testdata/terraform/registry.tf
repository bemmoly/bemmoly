# The shared image registry and who may pull from and push to it.

# The one registry every image is pushed to once and deployed from by digest.
resource "google_artifact_registry_repository" "apps" {
  project       = var.projects.bemmoly_control_583920174411
  location      = "us-central1"
  repository_id = "apps"
  format        = "DOCKER"
  description   = "Release images built or registered by Bemmoly"
}

resource "google_artifact_registry_repository_iam_member" "bemmoly_control_583920174411_builder_push" {
  project    = google_artifact_registry_repository.apps.project
  location   = google_artifact_registry_repository.apps.location
  repository = google_artifact_registry_repository.apps.name
  role       = "roles/artifactregistry.writer"
  member     = google_service_account.bemmoly_control_583920174411_builder.member
}

resource "google_artifact_registry_repository_iam_member" "acme_prod_7f3a_run_agent_pull" {
  project    = google_artifact_registry_repository.apps.project
  location   = google_artifact_registry_repository.apps.location
  repository = google_artifact_registry_repository.apps.name
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:service-${var.project_numbers.acme_prod_7f3a}@serverless-robot-prod.iam.gserviceaccount.com"
}

resource "google_artifact_registry_repository_iam_member" "acme_prod_7f3a_runtime_pull" {
  project    = google_artifact_registry_repository.apps.project
  location   = google_artifact_registry_repository.apps.location
  repository = google_artifact_registry_repository.apps.name
  role       = "roles/artifactregistry.reader"
  member     = google_service_account.acme_prod_7f3a_runtime.member
}

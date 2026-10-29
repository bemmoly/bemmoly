# Secret Manager secrets and who may read them. Values are never exported; they stay in
# Secret Manager, where Pipelines wrote them.

resource "google_secret_manager_secret" "bemmoly_checkout_api_db_url_prod" {
  project   = google_project.acme_prod_7f3a.project_id
  secret_id = "bemmoly-checkout-api-DB_URL-prod"
  labels = {
    managed-by = "bemmoly"
  }
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "bemmoly_payments_worker_stripe_key_prod" {
  project   = google_project.acme_prod_7f3a.project_id
  secret_id = "bemmoly-payments-worker-STRIPE_KEY-prod"
  labels = {
    managed-by = "bemmoly"
  }
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_iam_member" "bemmoly_checkout_api_db_url_prod_runtime" {
  project   = google_project.acme_prod_7f3a.project_id
  secret_id = google_secret_manager_secret.bemmoly_checkout_api_db_url_prod.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = google_service_account.acme_prod_7f3a_runtime.member
}

resource "google_secret_manager_secret_iam_member" "bemmoly_payments_worker_stripe_key_prod_checkout_payments_worker" {
  project   = google_project.acme_prod_7f3a.project_id
  secret_id = google_secret_manager_secret.bemmoly_payments_worker_stripe_key_prod.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "principal://iam.googleapis.com/projects/${var.project_numbers.acme_prod_7f3a}/locations/global/workloadIdentityPools/acme-prod-7f3a.svc.id.goog/subject/ns/checkout/sa/payments-worker"
}

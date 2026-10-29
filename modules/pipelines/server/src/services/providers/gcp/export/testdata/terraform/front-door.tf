# Each environment's front door: one load balancer per environment and project, with a host
# per application. A host still shifting traffic between runtimes is exported at the backend
# that takes most of it, so the move's weights in flight are left out.

# prod's front door in acme-prod-7f3a.

resource "google_compute_global_address" "prod_acme_prod_7f3a" {
  project      = google_project.acme_prod_7f3a.project_id
  name         = "bm-fd-prod"
  address_type = "EXTERNAL"
  ip_version   = "IPV4"
}

resource "google_compute_region_network_endpoint_group" "bm_run_checkout_api" {
  project               = google_project.acme_prod_7f3a.project_id
  region                = "us-central1"
  name                  = "bm-run-checkout-api"
  network_endpoint_type = "SERVERLESS"
  cloud_run {
    service = "checkout-api"
  }
}

resource "google_compute_backend_service" "bm_prod_checkout_api_run" {
  project               = google_project.acme_prod_7f3a.project_id
  name                  = "bm-prod-checkout-api-run"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  protocol              = "HTTP"
  backend {
    group = google_compute_region_network_endpoint_group.bm_run_checkout_api.id
  }
}

resource "google_compute_health_check" "bm_fd_prod_neg" {
  project = google_project.acme_prod_7f3a.project_id
  name    = "bm-fd-prod-neg"
  http_health_check {
    port_specification = "USE_SERVING_PORT"
    request_path       = "/"
  }
}

data "google_compute_network_endpoint_group" "fd_checkout_payments_worker_v2_1_0_a1c9e3f_80_us_central1_a" {
  project = google_project.acme_prod_7f3a.project_id
  zone    = "us-central1-a"
  name    = "fd-checkout-payments-worker-v2-1-0-a1c9e3f-80"
}

data "google_compute_network_endpoint_group" "fd_checkout_payments_worker_v2_1_0_a1c9e3f_80_us_central1_b" {
  project = google_project.acme_prod_7f3a.project_id
  zone    = "us-central1-b"
  name    = "fd-checkout-payments-worker-v2-1-0-a1c9e3f-80"
}

resource "google_compute_backend_service" "fd_checkout_payments_worker_v2_1_0_a1c9e3f_80" {
  project               = google_project.acme_prod_7f3a.project_id
  name                  = "fd-checkout-payments-worker-v2-1-0-a1c9e3f-80"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  protocol              = "HTTP"
  health_checks         = [google_compute_health_check.bm_fd_prod_neg.id]
  backend {
    group                 = data.google_compute_network_endpoint_group.fd_checkout_payments_worker_v2_1_0_a1c9e3f_80_us_central1_a.id
    balancing_mode        = "RATE"
    max_rate_per_endpoint = 100
  }
  backend {
    group                 = data.google_compute_network_endpoint_group.fd_checkout_payments_worker_v2_1_0_a1c9e3f_80_us_central1_b.id
    balancing_mode        = "RATE"
    max_rate_per_endpoint = 100
  }
}

resource "google_compute_url_map" "prod_acme_prod_7f3a" {
  project         = google_project.acme_prod_7f3a.project_id
  name            = "bm-fd-prod"
  default_service = google_compute_backend_service.bm_prod_checkout_api_run.id
  host_rule {
    hosts        = ["checkout-api.prod.acme.example"]
    path_matcher = "h-checkout-api-prod-acme-example"
  }
  host_rule {
    hosts        = ["payments-worker.prod.acme.example"]
    path_matcher = "h-payments-worker-prod-acme-example"
  }
  path_matcher {
    name = "h-checkout-api-prod-acme-example"
    default_route_action {
      weighted_backend_services {
        backend_service = google_compute_backend_service.bm_prod_checkout_api_run.id
        weight          = 100
      }
    }
  }
  path_matcher {
    name = "h-payments-worker-prod-acme-example"
    default_route_action {
      weighted_backend_services {
        backend_service = google_compute_backend_service.fd_checkout_payments_worker_v2_1_0_a1c9e3f_80.id
        weight          = 100
      }
    }
  }
}

resource "google_compute_managed_ssl_certificate" "prod_acme_prod_7f3a_checkout_api_prod_acme_example" {
  project = google_project.acme_prod_7f3a.project_id
  name    = "bm-fd-280ac2e7-checkout-api-prod-acme-example"
  managed {
    domains = ["checkout-api.prod.acme.example"]
  }
}

resource "google_compute_managed_ssl_certificate" "prod_acme_prod_7f3a_payments_worker_prod_acme_example" {
  project = google_project.acme_prod_7f3a.project_id
  name    = "bm-fd-8fb387c0-payments-worker-prod-acme-example"
  managed {
    domains = ["payments-worker.prod.acme.example"]
  }
}

resource "google_compute_target_https_proxy" "prod_acme_prod_7f3a" {
  project          = google_project.acme_prod_7f3a.project_id
  name             = "bm-fd-prod"
  url_map          = google_compute_url_map.prod_acme_prod_7f3a.id
  ssl_certificates = [google_compute_managed_ssl_certificate.prod_acme_prod_7f3a_checkout_api_prod_acme_example.id, google_compute_managed_ssl_certificate.prod_acme_prod_7f3a_payments_worker_prod_acme_example.id]
}

resource "google_compute_global_forwarding_rule" "prod_acme_prod_7f3a" {
  project               = google_project.acme_prod_7f3a.project_id
  name                  = "bm-fd-prod"
  ip_address            = google_compute_global_address.prod_acme_prod_7f3a.address
  ip_protocol           = "TCP"
  port_range            = "443"
  target                = google_compute_target_https_proxy.prod_acme_prod_7f3a.id
  load_balancing_scheme = "EXTERNAL_MANAGED"
}

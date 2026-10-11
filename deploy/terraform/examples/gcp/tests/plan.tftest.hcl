# Plans against a mocked provider: no credentials, no API calls, nothing created.

mock_provider "google" {}

variables {
  project = "example-project"
  domain  = "bemmoly.example.com"
}

run "defaults" {
  command = plan

  assert {
    condition     = google_compute_instance.bemmoly.machine_type == "e2-medium"
    error_message = "medium maps to e2-medium."
  }

  assert {
    condition     = google_compute_instance.bemmoly.boot_disk[0].initialize_params[0].size == 40
    error_message = "The boot disk is sized from the module."
  }

  assert {
    condition     = google_compute_instance.bemmoly.boot_disk[0].initialize_params[0].image == "ubuntu-os-cloud/ubuntu-2404-lts-amd64"
    error_message = "The VM boots the Ubuntu 24.04 LTS image family."
  }

  assert {
    condition     = startswith(google_compute_instance.bemmoly.metadata["user-data"], "#cloud-config\n")
    error_message = "The module's cloud-config is passed as user-data."
  }

  assert {
    condition     = toset(one(google_compute_firewall.web.allow).ports) == toset(["80", "443"]) && google_compute_firewall.web.source_ranges == toset(["0.0.0.0/0"])
    error_message = "Ports 80 and 443 are open to everyone."
  }

  assert {
    condition     = length(google_compute_firewall.ssh) == 0
    error_message = "SSH stays closed unless ranges are given."
  }

  assert {
    condition     = length(google_compute_address.bemmoly) == 1
    error_message = "A static address is reserved by default."
  }

  assert {
    condition     = output.url == "https://bemmoly.example.com" && output.dns_record.name == "bemmoly.example.com"
    error_message = "The outputs name the URL and the A record to create."
  }
}

run "large_with_ssh_and_ephemeral_ip" {
  command = plan

  variables {
    size              = "large"
    ssh_source_ranges = ["203.0.113.4/32"]
    static_ip         = false
  }

  assert {
    condition     = google_compute_instance.bemmoly.machine_type == "e2-custom-4-8192" && google_compute_instance.bemmoly.boot_disk[0].initialize_params[0].size == 80
    error_message = "large maps to 4 vCPU and 8 GB with an 80 GB disk."
  }

  assert {
    condition     = google_compute_firewall.ssh[0].source_ranges == toset(["203.0.113.4/32"])
    error_message = "SSH opens for the listed range only."
  }

  assert {
    condition     = length(google_compute_address.bemmoly) == 0
    error_message = "No static address when it is turned off."
  }
}

run "machine_type_override" {
  command = plan

  variables {
    size         = "small"
    machine_type = "t2a-standard-1"
  }

  assert {
    condition     = google_compute_instance.bemmoly.machine_type == "t2a-standard-1" && google_compute_instance.bemmoly.boot_disk[0].initialize_params[0].size == 30
    error_message = "machine_type overrides the size mapping; the disk still follows the size."
  }
}

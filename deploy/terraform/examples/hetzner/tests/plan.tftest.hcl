# Plans against a mocked provider: no token, no API calls, nothing created.

mock_provider "hcloud" {}

variables {
  domain = "bemmoly.example.com"
}

run "defaults" {
  command = plan

  assert {
    condition     = hcloud_server.bemmoly.server_type == "cx23" && hcloud_server.bemmoly.image == "ubuntu-24.04"
    error_message = "medium maps to cx23 running Ubuntu 24.04."
  }

  assert {
    condition     = startswith(hcloud_server.bemmoly.user_data, "#cloud-config\n")
    error_message = "The module's cloud-config is passed as user data."
  }

  assert {
    condition     = toset([for rule in hcloud_firewall.bemmoly.rule : rule.port]) == toset(["80", "443"])
    error_message = "Only ports 80 and 443 are open by default."
  }

  assert {
    condition     = alltrue([for rule in hcloud_firewall.bemmoly.rule : toset(rule.source_ips) == toset(["0.0.0.0/0", "::/0"])])
    error_message = "The web ports are open over IPv4 and IPv6."
  }

  assert {
    condition     = output.url == "https://bemmoly.example.com" && output.dns_records[0].type == "A" && output.dns_records[1].type == "AAAA"
    error_message = "The outputs name the URL and the A and AAAA records to create."
  }
}

run "large_with_ssh" {
  command = plan

  variables {
    size           = "large"
    ssh_keys       = ["admin"]
    ssh_source_ips = ["203.0.113.4/32"]
  }

  assert {
    condition     = hcloud_server.bemmoly.server_type == "cx33"
    error_message = "large maps to cx33."
  }

  assert {
    condition     = toset([for rule in hcloud_firewall.bemmoly.rule : rule.port]) == toset(["22", "80", "443"])
    error_message = "SSH opens when source ranges are given."
  }

  assert {
    condition     = one([for rule in hcloud_firewall.bemmoly.rule : rule.source_ips if rule.port == "22"]) == toset(["203.0.113.4/32"])
    error_message = "SSH opens for the listed range only."
  }

  assert {
    condition     = toset(hcloud_server.bemmoly.ssh_keys) == toset(["admin"])
    error_message = "The project's SSH keys are passed through."
  }
}

run "server_type_override" {
  command = plan

  variables {
    server_type = "cx43"
  }

  assert {
    condition     = hcloud_server.bemmoly.server_type == "cx43"
    error_message = "server_type overrides the size mapping."
  }
}

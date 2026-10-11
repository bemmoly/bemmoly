# Sizing per size, and the validations that stop a bad value before any VM exists.

variables {
  domain = "bemmoly.example.com"
}

run "small" {
  command = plan

  variables {
    size = "small"
  }

  assert {
    condition     = output.sizing == { vcpu = 1, memory_gb = 2, disk_gb = 30 }
    error_message = "small is 1 vCPU, 2 GB, 30 GB."
  }
}

run "medium_is_the_default" {
  command = plan

  assert {
    condition     = output.sizing == { vcpu = 2, memory_gb = 4, disk_gb = 40 }
    error_message = "medium is 2 vCPU, 4 GB, 40 GB."
  }
}

run "large" {
  command = plan

  variables {
    size = "large"
  }

  assert {
    condition     = output.sizing == { vcpu = 4, memory_gb = 8, disk_gb = 80 }
    error_message = "large is 4 vCPU, 8 GB, 80 GB."
  }
}

run "rejects_a_url_as_domain" {
  command = plan

  variables {
    domain = "https://bemmoly.example.com"
  }

  expect_failures = [var.domain]
}

run "rejects_a_domain_with_a_space" {
  command = plan

  variables {
    domain = "bemmoly example.com"
  }

  expect_failures = [var.domain]
}

run "rejects_an_unknown_size" {
  command = plan

  variables {
    size = "huge"
  }

  expect_failures = [var.size]
}

run "rejects_a_partial_version" {
  command = plan

  variables {
    bemmoly_version = "1.2"
  }

  expect_failures = [var.bemmoly_version]
}

run "accepts_a_beta_version" {
  command = plan

  variables {
    bemmoly_version = "1.3.0-beta.2"
  }

  assert {
    condition     = strcontains(yamldecode(output.user_data).runcmd[0], "--version 1.3.0-beta.2")
    error_message = "A pre-release version is passed through."
  }
}

run "rejects_an_unknown_channel" {
  command = plan

  variables {
    channel = "nightly"
  }

  expect_failures = [var.channel]
}

run "rejects_module_ids_with_spaces" {
  command = plan

  variables {
    modules = ["work", "Docs Module"]
  }

  expect_failures = [var.modules]
}

run "rejects_an_unknown_smtp_security" {
  command = plan

  variables {
    smtp = {
      host     = "smtp.example.com"
      security = "ssl"
    }
  }

  expect_failures = [var.smtp]
}

run "rejects_a_malformed_from_address" {
  command = plan

  variables {
    smtp = {
      host = "smtp.example.com"
      from = "not-an-address"
    }
  }

  expect_failures = [var.smtp]
}

run "rejects_an_s3_endpoint_without_scheme" {
  command = plan

  variables {
    backups_s3 = {
      endpoint          = "s3.example.com"
      bucket            = "acme-backups"
      access_key_id     = "AKIAEXAMPLE"
      secret_access_key = "example-secret"
    }
  }

  expect_failures = [var.backups_s3]
}

# The module has no resources, so a plan evaluates every output without any cloud access.

variables {
  domain = "bemmoly.example.com"
}

run "defaults_install_the_newest_stable_release" {
  command = plan

  assert {
    condition     = startswith(output.user_data, "#cloud-config\n")
    error_message = "The user data must start with the cloud-config header."
  }

  assert {
    condition     = contains(yamldecode(output.user_data).runcmd, "curl -fsSL https://get.bemmoly.com | sh -s -- --yes --domain bemmoly.example.com --channel stable")
    error_message = "With defaults, the installer runs with only --yes, --domain and --channel."
  }

  assert {
    condition     = length(yamldecode(output.user_data).runcmd) == 1
    error_message = "Without settings, the installer is the only command."
  }

  assert {
    condition     = !strcontains(output.user_data, "write_files") && !strcontains(output.user_data, "settings import")
    error_message = "Without SMTP or S3 inputs, no settings file is written or imported."
  }

  assert {
    condition     = !strcontains(output.user_data, "ssh_authorized_keys")
    error_message = "Without keys, no ssh_authorized_keys entry is added."
  }

  assert {
    condition     = contains(yamldecode(output.user_data).packages, "curl")
    error_message = "curl is installed before the installer runs."
  }

  assert {
    condition     = output.public_url == "https://bemmoly.example.com"
    error_message = "The public URL is https:// plus the domain."
  }
}

run "every_installer_flag" {
  command = plan

  variables {
    bemmoly_version     = "1.4.2"
    channel             = "beta"
    modules             = ["work", "docs"]
    in_app_updates      = false
    ssh_authorized_keys = ["ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIExample admin@example.com"]
  }

  assert {
    condition     = yamldecode(output.user_data).runcmd[0] == "curl -fsSL https://get.bemmoly.com | sh -s -- --yes --domain bemmoly.example.com --channel beta --version 1.4.2 --modules work,docs --no-in-app-updates"
    error_message = "Every installer option is passed through."
  }

  assert {
    condition     = yamldecode(output.user_data).ssh_authorized_keys == ["ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIExample admin@example.com"]
    error_message = "SSH keys are added to the cloud-config."
  }
}

run "smtp_settings_are_imported_then_removed" {
  command = plan

  variables {
    smtp = {
      host     = "smtp.example.com"
      username = "mailer"
      password = "s3cret"
      from     = "bemmoly@example.com"
    }
  }

  assert {
    condition = jsondecode(yamldecode(output.user_data).write_files[0].content) == {
      "email.provider"      = "smtp"
      "email.smtp.host"     = "smtp.example.com"
      "email.smtp.port"     = 587
      "email.smtp.security" = "starttls"
      "email.smtp.username" = "mailer"
      "email.smtp.password" = "s3cret"
      "email.from"          = "bemmoly@example.com"
    }
    error_message = "The settings file holds exactly the given SMTP keys, with the port and security defaults."
  }

  assert {
    condition = (
      yamldecode(output.user_data).write_files[0].path == "/root/bemmoly-settings.json" &&
      yamldecode(output.user_data).write_files[0].permissions == "0600" &&
      yamldecode(output.user_data).write_files[0].owner == "root:root"
    )
    error_message = "The settings file is root-owned and readable by root only."
  }

  assert {
    condition = slice(yamldecode(output.user_data).runcmd, 1, 3) == [
      "/usr/local/bin/bemmoly settings import /root/bemmoly-settings.json",
      "rm -f /root/bemmoly-settings.json",
    ]
    error_message = "The settings are imported after the install, then the file is removed."
  }
}

run "smtp_without_login_leaves_credentials_out" {
  command = plan

  variables {
    smtp = {
      host     = "relay.internal"
      port     = 25
      security = "none"
      reply_to = "support@example.com"
    }
  }

  assert {
    condition = jsondecode(yamldecode(output.user_data).write_files[0].content) == {
      "email.provider"      = "smtp"
      "email.smtp.host"     = "relay.internal"
      "email.smtp.port"     = 25
      "email.smtp.security" = "none"
      "email.replyTo"       = "support@example.com"
    }
    error_message = "Keys for inputs that were not given are left out of the settings file."
  }
}

run "s3_backups_only" {
  command = plan

  variables {
    backups_s3 = {
      endpoint          = "https://s3.eu-central-1.example.com"
      bucket            = "acme-backups"
      access_key_id     = "AKIAEXAMPLE"
      secret_access_key = "example-secret"
      force_path_style  = true
    }
  }

  assert {
    condition = jsondecode(yamldecode(output.user_data).write_files[0].content) == {
      "system.backups.s3" = {
        enabled         = true
        endpoint        = "https://s3.eu-central-1.example.com"
        region          = "us-east-1"
        bucket          = "acme-backups"
        prefix          = "bemmoly/"
        accessKeyId     = "AKIAEXAMPLE"
        secretAccessKey = "example-secret"
        forcePathStyle  = true
      }
    }
    error_message = "Only the S3 key is written, with the region and prefix defaults."
  }
}

run "s3_without_endpoint_omits_it" {
  command = plan

  variables {
    backups_s3 = {
      region            = "eu-west-1"
      bucket            = "acme-backups"
      access_key_id     = "AKIAEXAMPLE"
      secret_access_key = "example-secret"
    }
  }

  assert {
    condition     = !contains(keys(jsondecode(yamldecode(output.user_data).write_files[0].content)["system.backups.s3"]), "endpoint")
    error_message = "Without an endpoint the key is left out, so the app uses the default one."
  }
}

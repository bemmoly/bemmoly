locals {
  # The tech design's sizing table. All three share one disk between the images, Postgres,
  # uploads and the local backups (seven daily, four weekly and three monthly by default),
  # and the installer refuses to start with less than 10 GB free.
  sizes = {
    small  = { vcpu = 1, memory_gb = 2, disk_gb = 30 }
    medium = { vcpu = 2, memory_gb = 4, disk_gb = 40 }
    large  = { vcpu = 4, memory_gb = 8, disk_gb = 80 }
  }

  # Every value here passed a validation that allows only hostname, version and module-id
  # characters, so the command line needs no shell quoting. "latest" sends no --version,
  # which lets the installer pick the newest release of the chosen channel.
  installer_flags = concat(
    ["--yes", "--domain", var.domain, "--channel", var.channel],
    var.bemmoly_version == "latest" ? [] : ["--version", var.bemmoly_version],
    length(var.modules) == 0 ? [] : ["--modules", join(",", var.modules)],
    var.in_app_updates ? [] : ["--no-in-app-updates"],
  )
  install_command = "curl -fsSL https://get.bemmoly.com | sh -s -- ${join(" ", local.installer_flags)}"

  settings_path = "/root/bemmoly-settings.json"

  # Each value is JSON-encoded first so the optional keys can be merged as one map of strings;
  # the for expression below turns them back into numbers, strings and objects.
  settings_encoded = merge(
    var.smtp == null ? {} : {
      "email.provider"      = jsonencode("smtp")
      "email.smtp.host"     = jsonencode(var.smtp.host)
      "email.smtp.port"     = jsonencode(var.smtp.port)
      "email.smtp.security" = jsonencode(var.smtp.security)
    },
    try(var.smtp.username, "") == "" ? {} : { "email.smtp.username" = jsonencode(var.smtp.username) },
    try(var.smtp.password, "") == "" ? {} : { "email.smtp.password" = jsonencode(var.smtp.password) },
    try(var.smtp.from, "") == "" ? {} : { "email.from" = jsonencode(var.smtp.from) },
    try(var.smtp.reply_to, null) == null ? {} : { "email.replyTo" = jsonencode(var.smtp.reply_to) },
    var.backups_s3 == null ? {} : {
      "system.backups.s3" = jsonencode(merge(
        {
          enabled         = true
          region          = var.backups_s3.region
          bucket          = var.backups_s3.bucket
          prefix          = var.backups_s3.prefix
          accessKeyId     = var.backups_s3.access_key_id
          secretAccessKey = var.backups_s3.secret_access_key
          forcePathStyle  = var.backups_s3.force_path_style
        },
        var.backups_s3.endpoint == null ? {} : { endpoint = var.backups_s3.endpoint },
      ))
    },
  )
  settings     = { for key, value in local.settings_encoded : key => jsondecode(value) }
  has_settings = length(local.settings_encoded) > 0

  # The settings file is written before runcmd and removed right after the import, so the
  # secrets do not stay on disk; the import encrypts them with the install's secret key.
  cloud_config = {
    for key, value in {
      package_update      = true
      packages            = ["curl", "ca-certificates"]
      ssh_authorized_keys = length(var.ssh_authorized_keys) > 0 ? var.ssh_authorized_keys : null
      write_files = local.has_settings ? [{
        path        = local.settings_path
        owner       = "root:root"
        permissions = "0600"
        content     = jsonencode(local.settings)
      }] : null
      runcmd = concat(
        [local.install_command],
        local.has_settings ? [
          "/usr/local/bin/bemmoly settings import ${local.settings_path}",
          "rm -f ${local.settings_path}",
        ] : [],
      )
    } : key => value if value != null
  }
}

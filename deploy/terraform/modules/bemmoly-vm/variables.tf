# The validations mirror the installer's own (deploy/installer/lib/args.sh), so a bad value
# fails at plan time instead of on a VM that has already been paid for.

variable "domain" {
  description = "Hostname people will use, such as bemmoly.example.com. Point its DNS at the VM."
  type        = string

  validation {
    condition     = length(var.domain) <= 253 && can(regex("^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)*$", var.domain))
    error_message = "The domain must be a hostname such as bemmoly.example.com, without https:// or a path."
  }
}

variable "size" {
  description = "small (up to 50 people), medium (up to 200) or large (up to 1,000)."
  type        = string
  default     = "medium"

  validation {
    condition     = contains(["small", "medium", "large"], var.size)
    error_message = "The size must be small, medium or large."
  }
}

variable "bemmoly_version" {
  description = "Release to install, such as 1.2.0, or latest for the newest release in the channel, or beta."
  type        = string
  default     = "latest"

  validation {
    condition     = contains(["latest", "beta"], var.bemmoly_version) || can(regex("^v?[0-9]+\\.[0-9]+\\.[0-9]+(-[0-9A-Za-z.-]+)?$", var.bemmoly_version))
    error_message = "The version must look like 1.2.0, or be latest or beta."
  }
}

variable "channel" {
  description = "Update channel the install follows: stable or beta."
  type        = string
  default     = "stable"

  validation {
    condition     = contains(["stable", "beta"], var.channel)
    error_message = "The channel must be stable or beta."
  }
}

variable "modules" {
  description = "Module ids to enable, such as [\"work\", \"docs\"]. Empty leaves the choice to the setup wizard."
  type        = list(string)
  default     = []

  validation {
    condition     = alltrue([for id in var.modules : can(regex("^[a-z][a-z0-9-]*$", id))])
    error_message = "Module ids are lower case letters, digits and dashes, such as work or docs."
  }
}

variable "in_app_updates" {
  description = "Run the updater container so admins can update from Settings. When false, update with `sudo bemmoly upgrade`."
  type        = bool
  default     = true
}

variable "ssh_authorized_keys" {
  description = "Public keys added to the image's default user. Empty adds none."
  type        = list(string)
  default     = []
}

variable "smtp" {
  description = "Outgoing mail. Null leaves email to the setup wizard. These values end up in the VM's user data; see the README."
  type = object({
    host     = string
    port     = optional(number, 587)
    security = optional(string, "starttls")
    username = optional(string, "")
    password = optional(string, "")
    from     = optional(string, "")
    reply_to = optional(string)
  })
  default   = null
  sensitive = true

  validation {
    condition     = var.smtp == null || try(contains(["starttls", "tls", "none"], var.smtp.security), false)
    error_message = "The smtp.security must be starttls, tls or none."
  }

  validation {
    condition     = var.smtp == null || try(var.smtp.port >= 1 && var.smtp.port <= 65535 && floor(var.smtp.port) == var.smtp.port, false)
    error_message = "The smtp.port must be a whole number from 1 to 65535."
  }

  validation {
    condition     = var.smtp == null || try(trimspace(var.smtp.host) != "", false)
    error_message = "The smtp.host must not be empty."
  }

  validation {
    condition = var.smtp == null || try(alltrue([
      for address in [var.smtp.from, var.smtp.reply_to] :
      address == null || address == "" || can(regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", address))
    ]), false)
    error_message = "The smtp.from and smtp.reply_to must be email addresses, or empty."
  }
}

variable "backups_s3" {
  description = "Off-box copy of the nightly backups to S3 or an S3-compatible service. Null keeps backups on the VM only. These values end up in the VM's user data; see the README."
  type = object({
    endpoint          = optional(string)
    region            = optional(string, "us-east-1")
    bucket            = string
    prefix            = optional(string, "bemmoly/")
    access_key_id     = string
    secret_access_key = string
    force_path_style  = optional(bool, false)
  })
  default   = null
  sensitive = true

  validation {
    condition     = var.backups_s3 == null || try(var.backups_s3.endpoint == null || can(regex("^https?://[^\\s/]+", var.backups_s3.endpoint)), false)
    error_message = "The backups_s3.endpoint must be a URL such as https://s3.example.com, or null for the default endpoint."
  }

  validation {
    condition = var.backups_s3 == null || try(alltrue([
      for value in [var.backups_s3.region, var.backups_s3.bucket, var.backups_s3.access_key_id, var.backups_s3.secret_access_key] :
      trimspace(value) != ""
    ]), false)
    error_message = "The backups_s3 object needs a region, a bucket, an access key id and a secret access key."
  }
}

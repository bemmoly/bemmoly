provider "aws" {
  region = var.region

  default_tags {
    tags = merge({ Application = "bemmoly" }, var.tags)
  }
}

module "bemmoly" {
  source = "../../modules/bemmoly-vm"

  domain              = var.domain
  size                = var.size
  bemmoly_version     = var.bemmoly_version
  channel             = var.channel
  modules             = var.modules
  in_app_updates      = var.in_app_updates
  smtp                = var.smtp
  backups_s3          = var.backups_s3
  ssh_authorized_keys = var.ssh_authorized_keys
}

locals {
  # Burstable types for the two smaller sizes, where a team's load comes in bursts; the large
  # size gets a compute type with exactly the 4 vCPU and 8 GB the sizing table asks for.
  instance_types = {
    small  = "t3.small"
    medium = "t3.medium"
    large  = "c7i.xlarge"
  }
  instance_type = coalesce(var.instance_type, local.instance_types[var.size])
  vpc_id        = var.vpc_id != null ? var.vpc_id : data.aws_vpc.default[0].id
  public_ip     = var.elastic_ip ? aws_eip.bemmoly[0].public_ip : aws_instance.bemmoly.public_ip

  # Port 80 stays open: the proxy answers the certificate authority's HTTP challenge on it and
  # redirects everything else to HTTPS.
  web_ports = toset(["80", "443"])
}

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

data "aws_vpc" "default" {
  count   = var.vpc_id == null ? 1 : 0
  default = true
}

resource "aws_security_group" "bemmoly" {
  name        = var.name
  description = "Bemmoly: HTTP and HTTPS from anywhere, SSH only from the listed ranges"
  vpc_id      = local.vpc_id
}

resource "aws_vpc_security_group_ingress_rule" "web_ipv4" {
  for_each = local.web_ports

  security_group_id = aws_security_group.bemmoly.id
  ip_protocol       = "tcp"
  from_port         = tonumber(each.value)
  to_port           = tonumber(each.value)
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_ingress_rule" "web_ipv6" {
  for_each = local.web_ports

  security_group_id = aws_security_group.bemmoly.id
  ip_protocol       = "tcp"
  from_port         = tonumber(each.value)
  to_port           = tonumber(each.value)
  cidr_ipv6         = "::/0"
}

resource "aws_vpc_security_group_ingress_rule" "ssh" {
  for_each = toset(var.ssh_cidr_blocks)

  security_group_id = aws_security_group.bemmoly.id
  ip_protocol       = "tcp"
  from_port         = 22
  to_port           = 22
  cidr_ipv4         = each.value
}

# The installer pulls images and the certificate over the internet, so egress is open.
resource "aws_vpc_security_group_egress_rule" "all_ipv4" {
  security_group_id = aws_security_group.bemmoly.id
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_egress_rule" "all_ipv6" {
  security_group_id = aws_security_group.bemmoly.id
  ip_protocol       = "-1"
  cidr_ipv6         = "::/0"
}

resource "aws_instance" "bemmoly" {
  ami                         = data.aws_ami.ubuntu.id
  instance_type               = local.instance_type
  subnet_id                   = var.subnet_id
  vpc_security_group_ids      = [aws_security_group.bemmoly.id]
  key_name                    = var.key_name
  associate_public_ip_address = true
  user_data                   = module.bemmoly.user_data

  # IMDSv2 only: the user data can hold SMTP and S3 credentials, and session tokens keep a
  # server-side request forgery from reading it.
  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required"
  }

  root_block_device {
    volume_size = module.bemmoly.sizing.disk_gb
    volume_type = "gp3"
    encrypted   = true
  }

  tags = {
    Name = var.name
  }

  # A newer Ubuntu image or edited user data would otherwise replace the VM and its data.
  # Cloud-init only runs on the first boot; later changes go through Settings or the CLI.
  lifecycle {
    ignore_changes = [ami, user_data]

    # Without a subnet, AWS picks one in the default VPC, where a custom VPC's group cannot go.
    precondition {
      condition     = var.vpc_id == null || var.subnet_id != null
      error_message = "Set subnet_id to a public subnet of vpc_id."
    }
  }
}

resource "aws_eip" "bemmoly" {
  count = var.elastic_ip ? 1 : 0

  domain   = "vpc"
  instance = aws_instance.bemmoly.id

  tags = {
    Name = var.name
  }
}

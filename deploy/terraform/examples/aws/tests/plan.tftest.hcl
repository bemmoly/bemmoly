# Plans against a mocked provider: no credentials, no API calls, nothing created.

mock_provider "aws" {
  mock_data "aws_ami" {
    defaults = {
      id = "ami-0123456789abcdef0"
    }
  }

  mock_data "aws_vpc" {
    defaults = {
      id = "vpc-0default"
    }
  }
}

variables {
  domain = "bemmoly.example.com"
}

run "defaults" {
  command = plan

  assert {
    condition     = aws_instance.bemmoly.instance_type == "t3.medium"
    error_message = "medium maps to t3.medium."
  }

  assert {
    condition     = aws_instance.bemmoly.ami == "ami-0123456789abcdef0"
    error_message = "The instance boots the Ubuntu image the lookup found."
  }

  assert {
    condition     = aws_instance.bemmoly.root_block_device[0].volume_size == 40 && aws_instance.bemmoly.root_block_device[0].encrypted
    error_message = "The root volume is sized from the module and encrypted."
  }

  assert {
    condition     = aws_instance.bemmoly.metadata_options[0].http_tokens == "required"
    error_message = "Instance metadata requires IMDSv2 tokens."
  }

  assert {
    condition     = aws_security_group.bemmoly.vpc_id == "vpc-0default"
    error_message = "Without vpc_id, the default VPC is used."
  }

  assert {
    condition     = toset(keys(aws_vpc_security_group_ingress_rule.web_ipv4)) == toset(["80", "443"]) && length(aws_vpc_security_group_ingress_rule.web_ipv6) == 2
    error_message = "Ports 80 and 443 are open over IPv4 and IPv6."
  }

  assert {
    condition     = length(aws_vpc_security_group_ingress_rule.ssh) == 0
    error_message = "SSH stays closed unless ranges are given."
  }

  assert {
    condition     = length(aws_eip.bemmoly) == 1
    error_message = "An Elastic IP is attached by default."
  }

  assert {
    condition     = output.url == "https://bemmoly.example.com" && output.dns_record.type == "A" && output.dns_record.name == "bemmoly.example.com"
    error_message = "The outputs name the URL and the A record to create."
  }
}

run "large_with_ssh_and_own_network" {
  command = plan

  variables {
    size            = "large"
    ssh_cidr_blocks = ["203.0.113.4/32"]
    key_name        = "admin"
    vpc_id          = "vpc-0custom"
    subnet_id       = "subnet-0custom"
    elastic_ip      = false
  }

  assert {
    condition     = aws_instance.bemmoly.instance_type == "c7i.xlarge" && aws_instance.bemmoly.root_block_device[0].volume_size == 80
    error_message = "large maps to c7i.xlarge with an 80 GB disk."
  }

  assert {
    condition     = aws_vpc_security_group_ingress_rule.ssh["203.0.113.4/32"].from_port == 22
    error_message = "SSH opens for the listed range."
  }

  assert {
    condition     = aws_instance.bemmoly.key_name == "admin" && aws_instance.bemmoly.subnet_id == "subnet-0custom"
    error_message = "The key pair and subnet are passed through."
  }

  assert {
    condition     = length(data.aws_vpc.default) == 0 && aws_security_group.bemmoly.vpc_id == "vpc-0custom"
    error_message = "A given VPC replaces the default VPC lookup."
  }

  assert {
    condition     = length(aws_eip.bemmoly) == 0
    error_message = "No Elastic IP when it is turned off."
  }
}

run "custom_vpc_needs_a_subnet" {
  command = plan

  variables {
    vpc_id = "vpc-0custom"
  }

  expect_failures = [aws_instance.bemmoly]
}

run "instance_type_override" {
  command = plan

  variables {
    size          = "small"
    instance_type = "t4g.small"
  }

  assert {
    condition     = aws_instance.bemmoly.instance_type == "t4g.small" && aws_instance.bemmoly.root_block_device[0].volume_size == 30
    error_message = "instance_type overrides the size mapping; the disk still follows the size."
  }
}

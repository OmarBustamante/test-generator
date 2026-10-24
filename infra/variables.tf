variable "aws_region" {
  description = "AWS region for regional resources"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Base name"
  type        = string
  default     = "test-generator"
}

variable "bucket_name" {
  description = "S3 bucket for the frontend"
  type        = string
  default     = "test-generator-bugon"
}

variable "domain_name" {
  description = "Root domain"
  type        = string
  default     = "testgenerator.click"
}

variable "bedrock_region" {
  description = "Region used for Bedrock"
  type        = string
  default     = "us-east-1"
}

variable "model_id" {
  description = "Bedrock model ID"
  type        = string
  default     = "us.amazon.nova-lite-v1:0"
}
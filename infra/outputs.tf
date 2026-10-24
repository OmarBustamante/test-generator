output "api_base_url" {
  description = "Base api URL"
  value       = aws_apigatewayv2_api.http_api.api_endpoint
}

output "lambda_function_name" {
  description = "Name of the Lambda function"
  value       = aws_lambda_function.api.function_name
}

output "cloudfront_url" {
  description = "CloudFront URL"
  value       = "https://${aws_cloudfront_distribution.frontend.domain_name}"
}

output "s3_bucket_name" {
  description = "S3 bucket"
  value       = aws_s3_bucket.frontend.id
}

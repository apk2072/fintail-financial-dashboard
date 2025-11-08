#!/bin/bash
# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id E2RCLJ52L4H2Q9 --paths "/*"

#!/bin/bash

# Configuration - Set these as environment variables or update here
HOSTED_ZONE_ID="${HOSTED_ZONE_ID:-Z101237229AEOBS4RAR4V}"
CERT_ARN="${ACM_CERTIFICATE_ARN:-}"  # Set via environment variable
CLOUDFRONT_DOMAIN="${CLOUDFRONT_DOMAIN:-}"  # Get from CDK outputs

if [ -z "$CERT_ARN" ]; then
  echo "Error: ACM_CERTIFICATE_ARN environment variable is required"
  exit 1
fi

if [ -z "$CLOUDFRONT_DOMAIN" ]; then
  echo "Error: CLOUDFRONT_DOMAIN environment variable is required"
  exit 1
fi

echo "Setting up fintail.me domain..."
echo ""

# Step 1: Add certificate validation record
echo "Step 1: Adding certificate validation CNAME record..."
cat > /tmp/cert-validation.json <<EOF
{
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "_d52b04b4e8bb8f26e1bc60794d633c8a.fintail.me",
      "Type": "CNAME",
      "TTL": 300,
      "ResourceRecords": [{
        "Value": "_b9a4cefcd155cdf51037fbbabe1b21ef.jkddzztszm.acm-validations.aws."
      }]
    }
  }]
}
EOF

aws route53 change-resource-record-sets \
  --hosted-zone-id "$HOSTED_ZONE_ID" \
  --change-batch file:///tmp/cert-validation.json

echo "✅ Certificate validation record added"
echo ""

# Step 2: Wait for certificate validation
echo "Step 2: Waiting for certificate validation (this may take 5-30 minutes)..."
aws acm wait certificate-validated \
  --certificate-arn "$CERT_ARN" \
  --region us-east-1

echo "✅ Certificate validated!"
echo ""

# Step 3: Add CloudFront alias records
echo "Step 3: Adding CloudFront alias records for fintail.me and www.fintail.me..."
cat > /tmp/cloudfront-alias.json <<EOF
{
  "Changes": [
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "fintail.me",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z2FDTNDATAQYW2",
          "DNSName": "$CLOUDFRONT_DOMAIN",
          "EvaluateTargetHealth": false
        }
      }
    },
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "www.fintail.me",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z2FDTNDATAQYW2",
          "DNSName": "$CLOUDFRONT_DOMAIN",
          "EvaluateTargetHealth": false
        }
      }
    }
  ]
}
EOF

aws route53 change-resource-record-sets \
  --hosted-zone-id "$HOSTED_ZONE_ID" \
  --change-batch file:///tmp/cloudfront-alias.json

echo "✅ CloudFront alias records added"
echo ""

# Step 4: Show nameservers for GoDaddy
echo "Step 4: Update these nameservers in GoDaddy:"
echo ""
aws route53 get-hosted-zone --id "$HOSTED_ZONE_ID" \
  --query 'DelegationSet.NameServers' \
  --output table

echo ""
echo "🎉 Domain setup complete!"
echo ""
echo "Next steps:"
echo "1. Update nameservers in GoDaddy with the ones shown above"
echo "2. Deploy with: infrastructure/scripts/deploy.sh -e production"
echo "3. Wait for DNS propagation (up to 48 hours, usually much faster)"
echo "4. Visit https://fintail.me"

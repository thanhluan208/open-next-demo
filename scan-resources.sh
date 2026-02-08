#!/bin/bash

# Script to LIST all OpenNext-related resources before manual deletion
# This helps you see what exists before you delete anything

echo "=================================================="
echo "SCANNING FOR OPENNEXT RESOURCES"
echo "=================================================="
echo ""

# 1. CloudFormation Stacks
echo "1️⃣  CLOUDFORMATION STACKS:"
aws cloudformation list-stacks \
    --stack-status-filter CREATE_FAILED ROLLBACK_COMPLETE ROLLBACK_FAILED UPDATE_ROLLBACK_FAILED DELETE_FAILED CREATE_COMPLETE UPDATE_COMPLETE \
    --query 'StackSummaries[?contains(StackName, `OpenNext`)].{Name:StackName,Status:StackStatus}' \
    --output table 2>/dev/null || echo "   None found or error accessing"
echo ""

# 2. CloudFront Distributions
echo "2️⃣  CLOUDFRONT DISTRIBUTIONS:"
aws cloudfront list-distributions \
    --query 'DistributionList.Items[].{Id:Id,DomainName:DomainName,Enabled:Enabled,Comment:Comment}' \
    --output table 2>/dev/null || echo "   None found or error accessing"
echo ""

# 3. CloudFront Cache Policies ★ IMPORTANT
echo "3️⃣  CLOUDFRONT CACHE POLICIES (CUSTOM):"
aws cloudfront list-cache-policies --type custom \
    --query 'CachePolicyList.Items[].{Name:CachePolicy.CachePolicyConfig.Name,Id:CachePolicy.Id}' \
    --output table 2>/dev/null || echo "   None found or error accessing"
echo ""

# 4. CloudFront OAI
echo "4️⃣  CLOUDFRONT ORIGIN ACCESS IDENTITIES:"
aws cloudfront list-cloud-front-origin-access-identities \
    --query 'CloudFrontOriginAccessIdentityList.Items[].{Id:Id,Comment:Comment}' \
    --output table 2>/dev/null || echo "   None found or error accessing"
echo ""

# 5. Lambda Functions
echo "5️⃣  LAMBDA FUNCTIONS:"
aws lambda list-functions \
    --query 'Functions[?contains(FunctionName, `OpenNext`) || contains(FunctionName, `ServerFunction`) || contains(FunctionName, `ImageOpt`) || contains(FunctionName, `Revalidation`) || contains(FunctionName, `Custom`)].{Name:FunctionName,Runtime:Runtime,LastModified:LastModified}' \
    --output table 2>/dev/null || echo "   None found or error accessing"
echo ""

# 6. Lambda Layers
echo "6️⃣  LAMBDA LAYERS:"
aws lambda list-layers \
    --query 'Layers[?contains(LayerName, `Deploy`) || contains(LayerName, `AwsCli`) || contains(LayerName, `OpenNext`)].{Name:LayerName,LatestVersion:LatestMatchingVersion.Version}' \
    --output table 2>/dev/null || echo "   None found or error accessing"
echo ""

# 7. S3 Buckets
echo "7️⃣  S3 BUCKETS:"
echo "   Searching for buckets with: opennext, assets, cache, cdk"
aws s3 ls 2>/dev/null | grep -iE "opennext|assets|cache|cdktoolkit" || echo "   None found"
echo ""

# 8. DynamoDB Tables
echo "8️⃣  DYNAMODB TABLES:"
aws dynamodb list-tables \
    --query 'TableNames[?contains(@, `Cache`) || contains(@, `OpenNext`)]' \
    --output table 2>/dev/null || echo "   None found or error accessing"
echo ""

# 9. IAM Roles
echo "9️⃣  IAM ROLES:"
aws iam list-roles \
    --query 'Roles[?contains(RoleName, `OpenNext`) || contains(RoleName, `ServerFunction`) || contains(RoleName, `ImageOpt`) || contains(RoleName, `Revalidation`) || contains(RoleName, `CustomS3AutoDelete`) || contains(RoleName, `CustomCDKBucket`)].{Name:RoleName,Created:CreateDate}' \
    --output table 2>/dev/null || echo "   None found or error accessing"
echo ""

# 10. CloudWatch Log Groups
echo "🔟 CLOUDWATCH LOG GROUPS:"
aws logs describe-log-groups \
    --query 'logGroups[?contains(logGroupName, `OpenNext`) || contains(logGroupName, `ServerFunction`) || contains(logGroupName, `ImageOpt`) || contains(logGroupName, `Revalidation`) || contains(logGroupName, `/aws/lambda/`)].{Name:logGroupName,Size:storedBytes}' \
    --output table 2>/dev/null | head -20 || echo "   None found or error accessing"
echo "   (Showing first 20 results)"
echo ""

# Summary
echo "=================================================="
echo "SCAN COMPLETE"
echo "=================================================="
echo ""
echo "Next steps:"
echo "1. Review the resources listed above"
echo "2. For the IMMEDIATE ISSUE, delete the CloudFront Cache Policy named 'ImageCachePolicy'"
echo "3. Then try 'cdk deploy' again"
echo ""
echo "To delete the Cache Policy:"
echo "  POLICY_ID=<ID_FROM_ABOVE>"
echo "  ETAG=\$(aws cloudfront get-cache-policy --id \$POLICY_ID --query 'ETag' --output text)"
echo "  aws cloudfront delete-cache-policy --id \$POLICY_ID --if-match \$ETAG"
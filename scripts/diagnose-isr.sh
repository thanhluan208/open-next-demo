#!/bin/bash

# ISR On-Demand Diagnostic Script
# This script checks if your AWS infrastructure is properly configured for ISR

echo "🔍 ISR On-Demand Diagnostic Check"
echo "=================================="
echo ""

# Get stack outputs
echo "📊 Fetching CloudFormation stack outputs..."
STACK_NAME="OpenNextDemoStack"  # Adjust if your stack name is different

# Get outputs
DISTRIBUTION_ID=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" --output text 2>/dev/null)
CACHE_TABLE=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query "Stacks[0].Outputs[?OutputKey=='CacheTableName'].OutputValue" --output text 2>/dev/null)
QUEUE_URL=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query "Stacks[0].Outputs[?OutputKey=='RevalidationQueueUrl'].OutputValue" --output text 2>/dev/null)
DISTRIBUTION_URL=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query "Stacks[0].Outputs[?OutputKey=='DistributionUrl'].OutputValue" --output text 2>/dev/null)

if [ -z "$DISTRIBUTION_ID" ]; then
    echo "❌ Stack not found or not deployed. Please deploy first:"
    echo "   cd infrastructure && cdk deploy"
    exit 1
fi

echo "✅ Stack found: $STACK_NAME"
echo "   Distribution: $DISTRIBUTION_URL"
echo "   CloudFront ID: $DISTRIBUTION_ID"
echo "   Cache Table: $CACHE_TABLE"
echo ""

# Check DynamoDB
echo "📦 Checking DynamoDB cache table..."
CACHE_COUNT=$(aws dynamodb scan --table-name $CACHE_TABLE --select COUNT --query "Count" --output text 2>/dev/null)
echo "   Cache entries: $CACHE_COUNT"

if [ "$CACHE_COUNT" -gt 0 ]; then
    echo "   Sample entries:"
    aws dynamodb scan --table-name $CACHE_TABLE --max-items 3 --query "Items[*].[tag.S, path.S]" --output table
fi
echo ""

# Check SQS
echo "📨 Checking SQS revalidation queue..."
QUEUE_ATTRS=$(aws sqs get-queue-attributes --queue-url $QUEUE_URL --attribute-names ApproximateNumberOfMessages,ApproximateNumberOfMessagesNotVisible 2>/dev/null)
MESSAGES=$(echo $QUEUE_ATTRS | jq -r '.Attributes.ApproximateNumberOfMessages // "0"')
IN_FLIGHT=$(echo $QUEUE_ATTRS | jq -r '.Attributes.ApproximateNumberOfMessagesNotVisible // "0"')
echo "   Messages in queue: $MESSAGES"
echo "   Messages in flight: $IN_FLIGHT"
echo ""

# Check Lambda functions
echo "🔧 Checking Lambda functions..."
SERVER_FUNC=$(aws lambda list-functions --query "Functions[?contains(FunctionName, 'ServerFunction')].FunctionName" --output text)
REVALIDATION_FUNC=$(aws lambda list-functions --query "Functions[?contains(FunctionName, 'RevalidationFunction')].FunctionName" --output text)

if [ -n "$SERVER_FUNC" ]; then
    echo "   ✅ Server Function: $SERVER_FUNC"
else
    echo "   ❌ Server Function not found"
fi

if [ -n "$REVALIDATION_FUNC" ]; then
    echo "   ✅ Revalidation Function: $REVALIDATION_FUNC"
else
    echo "   ❌ Revalidation Function not found"
fi
echo ""

# Test the page
echo "🌐 Testing ISR page..."
echo "   URL: $DISTRIBUTION_URL/isr-on-demand"
echo ""
echo "   Fetching page..."
RESPONSE=$(curl -s -w "\n%{http_code}" "$DISTRIBUTION_URL/isr-on-demand")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ Page loaded successfully (HTTP $HTTP_CODE)"
else
    echo "   ❌ Page failed to load (HTTP $HTTP_CODE)"
fi
echo ""

# Recommendations
echo "💡 Next Steps:"
echo "   1. Visit: $DISTRIBUTION_URL/isr-on-demand"
echo "   2. Note the timestamp"
echo "   3. Click 'Trigger Revalidation' button"
echo "   4. Wait 2-3 seconds"
echo "   5. Refresh the page"
echo "   6. Check if timestamp changed"
echo ""
echo "   If timestamp doesn't change, check CloudWatch logs:"
echo "   aws logs tail /aws/lambda/$SERVER_FUNC --follow"
echo ""
echo "=================================="
echo "✅ Diagnostic complete!"

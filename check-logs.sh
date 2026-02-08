#!/bin/bash

# Script to check CloudWatch logs for debugging ISR revalidation

echo "🔍 Checking CloudWatch Logs for ISR Revalidation..."
echo ""

# Get the stack outputs
STACK_NAME="OpenNextDemoStack"

echo "📊 Getting stack information..."
DISTRIBUTION_ID=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" --output text)
CACHE_TABLE=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query "Stacks[0].Outputs[?OutputKey=='CacheTableName'].OutputValue" --output text)
QUEUE_URL=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query "Stacks[0].Outputs[?OutputKey=='RevalidationQueueUrl'].OutputValue" --output text)

echo "Distribution ID: $DISTRIBUTION_ID"
echo "Cache Table: $CACHE_TABLE"
echo "Queue URL: $QUEUE_URL"
echo ""

# Get Lambda function names
echo "📋 Finding Lambda functions..."
SERVER_FUNCTION=$(aws lambda list-functions --query "Functions[?contains(FunctionName, 'ServerFunction')].FunctionName" --output text | head -1)
REVALIDATION_FUNCTION=$(aws lambda list-functions --query "Functions[?contains(FunctionName, 'RevalidationFunction')].FunctionName" --output text | head -1)

echo "Server Function: $SERVER_FUNCTION"
echo "Revalidation Function: $REVALIDATION_FUNCTION"
echo ""

# Check recent logs
echo "📝 Checking Server Function logs (last 5 minutes)..."
aws logs tail /aws/lambda/$SERVER_FUNCTION --since 5m --format short

echo ""
echo "📝 Checking Revalidation Function logs (last 5 minutes)..."
aws logs tail /aws/lambda/$REVALIDATION_FUNCTION --since 5m --format short

echo ""
echo "📊 Checking SQS Queue..."
aws sqs get-queue-attributes --queue-url $QUEUE_URL --attribute-names All --query 'Attributes.{Messages:ApproximateNumberOfMessages,InFlight:ApproximateNumberOfMessagesNotVisible,Delayed:ApproximateNumberOfMessagesDelayed}'

echo ""
echo "📊 Checking DynamoDB Cache Table..."
aws dynamodb scan --table-name $CACHE_TABLE --max-items 5 --query 'Items[*].{Path:path.S,Tag:tag.S,RevalidatedAt:revalidatedAt.N}'

echo ""
echo "✅ Log check complete!"

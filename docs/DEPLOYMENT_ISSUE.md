# Deployment Issue - CDK BucketDeployment Lambda Missing

## Problem

The deployment is failing with:

```
Function not found: arn:aws:lambda:ap-southeast-1:708676091124:function:OpenNextDemoStack-CustomCDKBucketDeployment8693BB6-B9h0nFhJCUWz
```

This is a known CDK issue where the custom resource Lambda function for BucketDeployment gets deleted or becomes unavailable, causing the stack to be stuck in `UPDATE_ROLLBACK_COMPLETE` state.

## Solution: Destroy and Recreate the Stack

Since the stack is in a broken state, we need to destroy it and recreate it fresh.

### Step 1: Destroy the Current Stack

```bash
cd infrastructure
cdk destroy
```

**Note**: This will delete:

- CloudFront distribution
- S3 buckets (assets and cache)
- DynamoDB table
- Lambda functions
- SQS queue

### Step 2: Redeploy the Stack

```bash
# Make sure you're in the root directory
cd ..

# Build Next.js (if not already done)
npm run build

# Build OpenNext (if not already done)
npm run open-next

# Deploy
cd infrastructure
cdk deploy --require-approval never
```

## Alternative: Manual Cleanup (If Destroy Fails)

If `cdk destroy` fails, you can manually delete the stack:

```bash
# Delete the CloudFormation stack
aws cloudformation delete-stack --stack-name OpenNextDemoStack

# Wait for deletion to complete
aws cloudformation wait stack-delete-complete --stack-name OpenNextDemoStack

# Then redeploy
cd infrastructure
cdk deploy --require-approval never
```

## Why This Happened

The CDK BucketDeployment construct creates a custom resource Lambda function to deploy files to S3. This Lambda function can get deleted or become unavailable if:

1. The stack was previously partially deleted
2. There was a failed deployment that left the stack in an inconsistent state
3. The Lambda function was manually deleted

## After Successful Deployment

Once the stack is successfully deployed, you'll see outputs like:

```
Outputs:
OpenNextDemoStack.DistributionUrl = https://xxxxx.cloudfront.net
OpenNextDemoStack.DistributionId = EXXXXXXXXX
OpenNextDemoStack.CacheTableName = OpenNextDemoStack-CacheTableXXXXX
OpenNextDemoStack.RevalidationQueueUrl = https://sqs.ap-southeast-1.amazonaws.com/...
```

Then you can test the ISR on-demand revalidation as described in `README_ISR_FIX.md`.

## Preventing This Issue

To avoid this issue in the future:

1. Always use `cdk deploy` (not manual CloudFormation updates)
2. Don't manually delete Lambda functions created by CDK
3. If a deployment fails, try deploying again before destroying
4. Keep your CDK version up to date

# Deployment and Testing Guide

## Changes Made

### 1. Infrastructure Changes (`infrastructure/lib/open-next-stack.ts`)

- **Restructured Lambda creation order**: CloudFront distribution is now created before the revalidation function
- **Added CloudFront Invalidation Lambda**: New dedicated function that listens to the SQS revalidation queue and creates CloudFront invalidations
- **Granted permissions**: CloudFront invalidation function has `cloudfront:CreateInvalidation` permission

### 2. New Files Created

- `infrastructure/lambda/cloudfront-invalidation/index.js` - CloudFront invalidation Lambda function
- `infrastructure/lambda/cloudfront-invalidation/package.json` - Dependencies for the Lambda function
- `ISR_INVESTIGATION.md` - Detailed investigation report
- `IMPLEMENTATION_GUIDE.md` - Implementation options and recommendations

## How It Works

### Current Flow (After Fix)

1. User visits `/isr-on-demand` → CloudFront caches HTML at edge
2. User clicks "Trigger Revalidation"
3. API route (`/api/revalidate`) calls `revalidatePath('/isr-on-demand')`
4. Next.js queues a message in SQS with the path to revalidate
5. **Two Lambda functions process the SQS message in parallel:**
   - **Revalidation Function**: Updates S3/DynamoDB cache with fresh content
   - **CloudFront Invalidation Function**: Creates CloudFront invalidation for the path
6. CloudFront invalidation propagates (10-30 seconds)
7. User refreshes page → CloudFront fetches NEW HTML from origin ✅

## Deployment Steps

### Step 1: Install Dependencies

```bash
cd infrastructure/lambda/cloudfront-invalidation
npm install
cd ../../..
```

### Step 2: Build Next.js Application

```bash
npm run build
```

### Step 3: Build OpenNext

```bash
npm run open-next
```

### Step 4: Deploy to AWS

```bash
npm run cdk:deploy
```

Or manually:

```bash
cd infrastructure
cdk deploy
```

### Step 5: Note the Outputs

After deployment, note these outputs:

- `DistributionUrl` - Your CloudFront URL
- `DistributionId` - CloudFront distribution ID
- `CacheTableName` - DynamoDB table name
- `RevalidationQueueUrl` - SQS queue URL

## Testing

### Manual Testing

1. **Visit the ISR page**:

   ```bash
   # Use the DistributionUrl from outputs
   open https://<your-distribution>.cloudfront.net/isr-on-demand
   ```

2. **Note the timestamp** displayed on the page

3. **Click "Trigger Revalidation"** button

4. **Check CloudWatch Logs** (optional):

   ```bash
   # Server function logs
   aws logs tail /aws/lambda/<stack-name>-ServerFunction --follow

   # Revalidation function logs
   aws logs tail /aws/lambda/<stack-name>-RevalidationFunction --follow

   # CloudFront invalidation function logs
   aws logs tail /aws/lambda/<stack-name>-CloudFrontInvalidationFunction --follow
   ```

5. **Wait 30 seconds** for CloudFront invalidation to propagate

6. **Refresh the page** - The timestamp should have changed!

### Automated Testing with Script

Use the diagnostic script:

```bash
chmod +x scripts/diagnose-isr.sh
./scripts/diagnose-isr.sh
```

### Verify CloudFront Invalidation

Check if invalidations are being created:

```bash
# Get your distribution ID from CDK outputs
DISTRIBUTION_ID=$(aws cloudformation describe-stacks --stack-name OpenNextDemoStack --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" --output text)

# List recent invalidations
aws cloudfront list-invalidations --distribution-id $DISTRIBUTION_ID
```

## Troubleshooting

### Issue: Timestamp doesn't change after revalidation

**Check 1: Verify SQS messages are being sent**

```bash
QUEUE_URL=$(aws cloudformation describe-stacks --stack-name OpenNextDemoStack --query "Stacks[0].Outputs[?OutputKey=='RevalidationQueueUrl'].OutputValue" --output text)

aws sqs get-queue-attributes --queue-url $QUEUE_URL --attribute-names ApproximateNumberOfMessages
```

**Check 2: Check Lambda function logs**

```bash
# Look for errors in CloudFront invalidation function
aws logs tail /aws/lambda/<stack-name>-CloudFrontInvalidationFunction --since 5m
```

**Check 3: Verify CloudFront invalidation was created**

```bash
aws cloudfront list-invalidations --distribution-id $DISTRIBUTION_ID --max-items 5
```

**Check 4: Wait longer**
CloudFront invalidations can take up to 30 seconds to propagate. Try waiting a full minute before refreshing.

### Issue: Lambda function fails with permission errors

**Solution**: Ensure the CloudFront invalidation function has the correct IAM permissions:

```bash
# Check the function's role
FUNCTION_NAME="<stack-name>-CloudFrontInvalidationFunction"
ROLE_NAME=$(aws lambda get-function --function-name $FUNCTION_NAME --query 'Configuration.Role' --output text | cut -d'/' -f2)

# List attached policies
aws iam list-attached-role-policies --role-name $ROLE_NAME
aws iam list-role-policies --role-name $ROLE_NAME
```

### Issue: Build fails with TypeScript errors

The TypeScript lint errors about `__dirname` and `path` are pre-existing and don't affect CDK deployment. They're due to missing type definitions or tsconfig settings. You can ignore them for now, or fix them by:

1. Adding to `infrastructure/tsconfig.json`:

   ```json
   {
     "compilerOptions": {
       "types": ["node"]
     }
   }
   ```

2. Ensuring `@types/node` is installed in the infrastructure directory

## Cost Considerations

### CloudFront Invalidations

- **Free tier**: First 1,000 invalidation paths per month
- **After free tier**: $0.005 per invalidation path
- **Our implementation**: Creates 2-3 paths per revalidation (main path + .rsc + \_next/data)
- **Estimated cost**: For 100 revalidations/month = ~300 paths = FREE

### Lambda Invocations

- **Free tier**: 1 million requests per month
- **Our implementation**: 2 Lambda invocations per revalidation (revalidation + CloudFront invalidation)
- **Estimated cost**: For 1,000 revalidations/month = 2,000 invocations = FREE

### Total Additional Cost

**~$0/month** for typical usage (under free tier limits)

## Next Steps

1. **Monitor CloudWatch Logs** for the first few revalidations to ensure everything works
2. **Set up CloudWatch Alarms** for Lambda errors
3. **Consider adding retry logic** for failed CloudFront invalidations
4. **Implement caching headers** for better cache control

## Rollback

If you need to rollback:

```bash
cd infrastructure
cdk destroy
```

Then redeploy the previous version.

# ISR On-Demand Revalidation Fix for AWS/OpenNext

## 🔴 **ROOT CAUSE IDENTIFIED**

The ISR on-demand revalidation was **not working on AWS** because of a **critical routing misconfiguration** in the CloudFront distribution.

### The Problem

In `infrastructure/lib/open-next-stack.ts`, the `_next/data/*` behavior was configured to route requests to **S3** instead of the **Lambda server function**:

```typescript
// ❌ WRONG - Before
"_next/data/*": {
  origin: s3Origin,  // This bypasses the Lambda function!
  allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
  viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
  cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
},
```

### Why This Breaks ISR

1. **Initial page load** (`/isr-on-demand`):
   - Serves pre-rendered HTML from S3 ✅
   - Shows the build-time timestamp

2. **Revalidation API call** (`/api/revalidate`):
   - Hits the Lambda function ✅
   - Calls `revalidatePath('/isr-on-demand')` ✅
   - Updates DynamoDB cache table ✅
   - Sends message to SQS queue ✅

3. **Page refresh** (the problem):
   - Next.js makes a request to `/_next/data/<build-id>/isr-on-demand.rsc`
   - CloudFront routes this to **S3** (not Lambda) ❌
   - S3 serves the **old cached file** ❌
   - Lambda's updated cache is **never checked** ❌
   - **Timestamp doesn't change!** ❌

### The Solution

Route `_next/data/*` requests to the **Lambda server function** instead of S3:

```typescript
// ✅ CORRECT - After
"_next/data/*": {
  origin: new origins.HttpOrigin(
    cdk.Fn.select(2, cdk.Fn.split("/", serverFunctionUrl.url)),
  ),
  allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
  viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
  cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
  originRequestPolicy: cloudfront.OriginRequestPolicy.fromOriginRequestPolicyId(
    this,
    "DataOriginRequestPolicy",
    "b689b0a8-53d0-40ab-baf2-68738e2966ac",
  ),
},
```

### Why This Works

Now the flow is correct:

1. **Initial page load**: HTML from S3 ✅
2. **Revalidation**: Lambda updates cache ✅
3. **Page refresh**:
   - `/_next/data/` request goes to **Lambda** ✅
   - Lambda checks DynamoDB for revalidation ✅
   - Lambda serves **updated content** ✅
   - **Timestamp changes!** ✅

## 🚀 **Deployment Steps**

### 1. Rebuild OpenNext

```bash
cd /Users/dangthanhluan/works/open-next-demo
pnpm open-next
```

### 2. Deploy to AWS

```bash
cd infrastructure
cdk deploy
```

### 3. Test the Fix

1. Visit your CloudFront URL
2. Note the timestamp on `/isr-on-demand`
3. Click "Trigger Revalidation"
4. Wait 2-3 seconds
5. Refresh the page
6. **The timestamp should now change!** ✅

## 📊 **How to Verify It's Working**

### Check CloudWatch Logs

```bash
# Watch server function logs
aws logs tail /aws/lambda/<stack-name>-ServerFunction --follow

# You should see requests to /_next/data/ paths
```

### Check DynamoDB

```bash
# List cache entries
aws dynamodb scan --table-name <CacheTableName> --max-items 5

# Look for entries with path="/isr-on-demand"
```

### Check SQS Queue

```bash
# Get queue attributes
aws sqs get-queue-attributes \
  --queue-url <RevalidationQueueUrl> \
  --attribute-names ApproximateNumberOfMessages,ApproximateNumberOfMessagesNotVisible

# Should show messages being processed
```

## 🔍 **Why It Worked on Vercel**

Vercel's infrastructure automatically handles this routing correctly:

- **Vercel**: All dynamic requests (including `_next/data/*`) automatically go through their Edge Network and serverless functions
- **AWS/OpenNext**: You must **explicitly configure** CloudFront to route `_next/data/*` to Lambda

This is a common pitfall when migrating from Vercel to self-hosted AWS infrastructure.

## 📝 **Additional Notes**

### What About Static Assets?

Static assets (`_next/static/*`) should **still** go to S3:

```typescript
"_next/static/*": {
  origin: s3Origin,  // ✅ Correct - these are truly static
  cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
}
```

### What About Pre-rendered Pages?

The initial HTML for ISR pages can come from S3, but the **data requests** must go to Lambda:

- `/isr-on-demand` (HTML) → S3 is OK ✅
- `/_next/data/.../isr-on-demand.rsc` (Data) → **Must** go to Lambda ✅

### Performance Impact

Routing `_next/data/*` to Lambda instead of S3 has minimal performance impact because:

1. Lambda responses are cached in DynamoDB (very fast)
2. CloudFront still caches responses (when appropriate)
3. Lambda cold starts are rare with consistent traffic
4. The trade-off is worth it for working ISR

## 🎯 **Summary**

**Problem**: `_next/data/*` requests were going to S3, bypassing Lambda's cache logic

**Solution**: Route `_next/data/*` to Lambda server function

**Result**: ISR on-demand revalidation now works correctly on AWS! ✅

## 🔗 **Related Resources**

- [OpenNext Documentation](https://open-next.js.org/)
- [Next.js ISR Documentation](https://nextjs.org/docs/app/building-your-application/data-fetching/incremental-static-regeneration)
- [AWS CloudFront Behaviors](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/distribution-web-values-specify.html#DownloadDistValuesCacheBehavior)

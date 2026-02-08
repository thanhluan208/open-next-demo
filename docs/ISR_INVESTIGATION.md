# ISR On-Demand Investigation Report

## Problem Statement

The `/isr-on-demand` page is not serving new content when users click the "Trigger Revalidation" button, even though the same code works properly on Vercel infrastructure.

## Current Configuration Analysis

### ✅ What's Working Correctly

1. **Page Configuration** (`app/isr-on-demand/page.tsx`)
   - ✅ `revalidate = false` - Correctly set for on-demand ISR
   - ✅ Pre-rendered at build time (confirmed in `.open-next/cache/`)
   - ✅ Build manifest shows `"initialRevalidateSeconds": false`

2. **API Route** (`app/api/revalidate/route.ts`)
   - ✅ Calls `revalidatePath(path, type)` correctly
   - ✅ Has proper logging
   - ✅ Returns success response

3. **Infrastructure** (`infrastructure/lib/open-next-stack.ts`)
   - ✅ DynamoDB table with correct GSIs (`revalidate` and `revalidate-tag`)
   - ✅ SQS queue for revalidation
   - ✅ Revalidation Lambda function
   - ✅ Proper IAM permissions

4. **OpenNext Configuration** (`open-next.config.ts`)
   - ✅ `incrementalCache: "s3"` - Cache stored in S3
   - ✅ `tagCache: "dynamodb"` - Tags in DynamoDB
   - ✅ `queue: "sqs"` - Queue configured

### ❌ Critical Issues Found

#### Issue #1: CloudFront Cache Invalidation Missing

**Problem:** When `revalidatePath()` is called:

1. It updates the cache in S3/DynamoDB ✅
2. It queues a revalidation message in SQS ✅
3. **BUT** CloudFront still serves the old cached HTML from its edge locations ❌

**Why this works on Vercel:**

- Vercel's infrastructure automatically invalidates their CDN cache when revalidation occurs
- AWS CloudFront requires explicit invalidation

**Evidence:**

- CloudFront distribution has `CACHING_DISABLED` for default behavior
- However, the initial HTML page is still cached by CloudFront
- No CloudFront invalidation is triggered after revalidation

#### Issue #2: Missing Cache Headers for ISR Pages

**Problem:** The infrastructure doesn't have specific cache behavior for ISR pages that would:

1. Allow cache-control headers from the origin to pass through
2. Respect stale-while-revalidate patterns
3. Check for cache updates

**Current State:**

```typescript
// Default behavior - applies to all routes including /isr-on-demand
defaultBehavior: {
  origin: serverFunctionUrl,
  cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,  // ⚠️ This is misleading
  // ...
}
```

Even with `CACHING_DISABLED`, CloudFront may still cache responses based on origin headers.

#### Issue #3: Middleware Edge Function Not Deployed

**Problem:** The `open-next.output.json` shows middleware should be deployed as an edge function:

```json
"edgeFunctions": {
  "middleware": {
    "bundle": ".open-next/middleware",
    "handler": "handler.handler"
  }
}
```

**Current State:**

- The CDK stack doesn't deploy the middleware as a CloudFront Function or Lambda@Edge
- This middleware might be responsible for handling revalidation headers

## Root Cause Analysis

The primary issue is **CloudFront caching**. Here's the flow:

### Current (Broken) Flow:

1. User visits `/isr-on-demand` → CloudFront caches HTML at edge
2. User clicks "Trigger Revalidation"
3. API route calls `revalidatePath('/isr-on-demand')`
4. S3/DynamoDB cache is updated ✅
5. SQS message is queued ✅
6. Revalidation Lambda processes the message ✅
7. **User refreshes page → CloudFront serves OLD cached HTML from edge** ❌

### Expected (Working) Flow:

1. User visits `/isr-on-demand` → CloudFront caches HTML at edge
2. User clicks "Trigger Revalidation"
3. API route calls `revalidatePath('/isr-on-demand')`
4. S3/DynamoDB cache is updated ✅
5. SQS message is queued ✅
6. Revalidation Lambda processes the message ✅
7. **CloudFront cache is invalidated** ✅
8. User refreshes page → CloudFront fetches NEW HTML from origin ✅

## Proposed Solutions

### Solution 1: Add CloudFront Invalidation to Revalidation Function (Recommended)

Modify the revalidation Lambda to invalidate CloudFront cache:

**Pros:**

- Ensures CloudFront serves fresh content immediately
- Follows AWS best practices
- Minimal changes to existing code

**Cons:**

- CloudFront invalidations have a cost (first 1000/month free)
- Slight delay (usually 10-30 seconds) for invalidation to propagate

### Solution 2: Use Cache-Control Headers with Short TTL

Configure CloudFront to respect cache-control headers from the origin:

**Pros:**

- No invalidation costs
- More granular control

**Cons:**

- Requires careful cache policy configuration
- May increase origin requests

### Solution 3: Deploy Middleware as Lambda@Edge

Deploy the middleware bundle as Lambda@Edge to handle revalidation headers:

**Pros:**

- Follows OpenNext's intended architecture
- May handle edge cases better

**Cons:**

- More complex deployment
- Lambda@Edge has limitations

## Recommended Fix

Implement **Solution 1** with the following changes:

1. **Update Revalidation Function** to invalidate CloudFront
2. **Grant CloudFront invalidation permissions** to the revalidation Lambda
3. **Pass CloudFront Distribution ID** as an environment variable
4. **Add logging** to track invalidations

## Testing Plan

After implementing the fix:

1. Deploy the updated infrastructure
2. Visit `/isr-on-demand` and note the timestamp
3. Click "Trigger Revalidation"
4. Check CloudWatch logs for:
   - Revalidation API call
   - SQS message processing
   - CloudFront invalidation request
5. Wait 30 seconds for invalidation to propagate
6. Refresh the page
7. Verify the timestamp has changed

## Additional Recommendations

1. **Add monitoring** for revalidation failures
2. **Implement retry logic** for CloudFront invalidations
3. **Add cache tags** to the HTML responses for better cache management
4. **Consider using CloudFront Functions** for lightweight header manipulation

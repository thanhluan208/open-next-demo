# Implementation Guide: CloudFront Invalidation for ISR

## Problem

The revalidation function updates the cache in S3/DynamoDB, but CloudFront continues serving stale content from its edge locations.

## Solution Options

### Option 1: Separate CloudFront Invalidation Lambda (Recommended)

Create a separate Lambda function that listens to the same SQS queue and handles CloudFront invalidation.

**Pros:**

- Clean separation of concerns
- Doesn't modify OpenNext build output
- Easy to debug and maintain
- Can be disabled/enabled independently

**Cons:**

- Slight additional cost (minimal)
- Two Lambda functions processing the same queue

### Option 2: Modify Revalidation Function with Layer

Add a Lambda Layer that wraps the revalidation function.

**Pros:**

- Single Lambda function
- Lower cost

**Cons:**

- More complex to implement
- Harder to maintain across OpenNext updates
- Requires modifying build output

### Option 3: Use CloudFront Function for Cache Headers

Configure CloudFront to respect cache-control headers and use shorter TTLs.

**Pros:**

- No additional Lambda costs
- Works with standard HTTP caching

**Cons:**

- Doesn't provide immediate invalidation
- May increase origin requests
- Less control over when content updates

## Recommended Implementation: Option 1

### Step 1: Create CloudFront Invalidation Lambda

Create a new Lambda function that:

1. Listens to the same SQS revalidation queue
2. Extracts the paths from the messages
3. Creates CloudFront invalidations

### Step 2: Update CDK Stack

Add the new Lambda function to the infrastructure with:

- SQS event source (same queue as revalidation function)
- CloudFront invalidation permissions
- CloudFront distribution ID in environment

### Step 3: Deploy and Test

1. Deploy the updated infrastructure
2. Trigger revalidation via the API
3. Check CloudWatch logs for both functions
4. Verify CloudFront invalidation is created
5. Wait 30 seconds and refresh the page

## Alternative: Quick Fix with Cache-Control Headers

If you need a quick solution without infrastructure changes:

1. Update the ISR page to include cache-control headers
2. Configure CloudFront to respect these headers
3. Set a short TTL (e.g., 60 seconds)

This won't provide immediate updates but will ensure content refreshes within the TTL period.

## Cost Considerations

- CloudFront invalidations: First 1,000/month free, then $0.005 per path
- Lambda invocations: Minimal cost (same as current revalidation function)
- Recommended: Use path patterns to minimize invalidation costs (e.g., `/isr-on-demand*` instead of individual files)

# On-Demand ISR Troubleshooting & Resolution Log

This document outlines the investigation and resolution process for getting On-Demand Incremental Static Regeneration (ISR) fully operational with OpenNext on AWS, specifically without resorting to embedding the AWS SDK directly inside the Next.js application codebase.

## The Objective

To ensure that a call to `revalidatePath('/path', 'page')` inside a Next.js App Router API route successfully:

1. Clears the Next.js origin cache.
2. Triggers a CloudFront cache invalidation.
3. Serves the newly generated page on the next request.

## The Journey & Challenges

### Attempt 1: Next.js Version Incompatibility (A Red Herring)

- **Issue:** Initially running Next.js `16.1.6`, the `revalidatePath` function was entirely failing to emit SQS revalidation messages through OpenNext's internal cache handlers.
- **Action:** Downgraded Next.js to `15.1.12`.
- **Result:** This resolved the immediate hook failure, but introduced an OpenNext build error regarding edge functions (`Multiple routes cannot be bundled into the same edge function`).
- **Fix:** Updated `open-next.config.ts` to separate `/api/time` and `/edge` into distinct edge execution environments.
- **Hindsight:** As we soon learned, this downgrade was likely completely unnecessary. Because we ultimately implemented a custom Webhook architecture that bypasses OpenNext's internal cache handlers by manually deleting files via the AWS SDK, Next.js v16 would likely have worked flawlessly with our final solution.

### Attempt 2: DynamoDB Streams (The Silent Failure)

- **Theory:** OpenNext uses a `CacheTable` in DynamoDB to track revalidation tags. We deployed a `StreamProcessorFunction` to listen for deletions in this table and subsequently push messages to the `InvalidationQueue`.
- **Issue:** Explicitly calling `revalidatePath(path, 'page')` (without specific custom tags) was not reliably triggering the expected DynamoDB `REMOVE` events for the stream to catch.
- **Action:** Abandoned the DynamoDB stream approach in favor of a more direct, explicit notification mechanism.

### Attempt 3: The Dedicated Webhook & Payload Mismatch

- **Theory:** If we can't trust the internal cache handler to trigger the infrastructure, we can manually trigger it. We created a lightweight `WebhookFunction` Lambda with a public Function URL.
- **Implementation:** The Next.js API route (`/api/revalidate`) was updated to call `revalidatePath` and then immediately `fetch(process.env.WEBHOOK_URL)`. The Webhook Lambda takes the path and pushes it to the `InvalidationQueue`.
- **Issue:** The webhook executed successfully, but CloudFront wasn't clearing. Inspecting the `CloudFrontInvalidationFunction` logs revealed it was ignoring our messages. The Webhook was sending `{"paths": ["/isr-on-demand"]}`, but the invalidator expected `{"url": "/isr-on-demand"}`.
- **Fix:** Corrected the JSON payload format in `infrastructure/lambda/webhook/index.mjs`.

### Attempt 4: The Final Boss - OpenNext's Stale S3 Cache

- **Issue:** After fixing the payload, CloudFront successfully invalidated! However, refreshing the page _still_ showed the old timestamp.
- **Root Cause:** CloudFront was correctly asking the Next.js origin for a fresh page. However, OpenNext's `IncrementalCache` S3 adapter was failing to delete the old `.cache`, `.html`, and `.rsc` files from the central `CacheBucket` when `revalidatePath` was called. When the Next.js server function spun up to handle the "cache miss" from CloudFront, it looked in the S3 `CacheBucket`, found the old files that were never deleted, and served them again.
- **The Ultimate Fix:** We shifted the responsibility of cache cleanup to our reliable Webhook.
  1.  Granted `cacheBucket.grantReadWrite(webhookFunction)` in the CDK stack.
  2.  Updated the Webhook code to query the S3 bucket using `ListObjectsV2Command`.
  3.  The Webhook now iterates through all Build IDs (e.g., `TLak.../`, `UNyS.../`) and explicitly runs a `DeleteObjectCommand` for any file ending in `.cache`, `.html`, `.rsc`, or `.json` that matches the target path.
  4.  _After_ the S3 bucket is purged, the Webhook sends the SQS message to invalidate CloudFront.

## Conclusion & Current Architecture

The final, working architecture for On-Demand ISR looks like this:

1.  **User/Client** calls `/api/revalidate` with a POST payload `{"path": "/isr-on-demand"}`.
2.  **Next.js Server** calls `revalidatePath` (which internally does very little in this specific serverless context).
3.  **Next.js Server** makes a non-blocking `fetch` to our AWS Lambda Webhook URL and returns a `200 OK` to the user immediately.
4.  **Webhook Lambda (AWS SDK)** receives the path.
5.  **Webhook Lambda** scans the `CacheBucket` (S3) and physically deletes all stale artifact files for that specific route.
6.  **Webhook Lambda** pushes a message to the `InvalidationQueue` (SQS).
7.  **CloudFront Invalidation Lambda** consumes the SQS message and triggers a `/*` invalidation for that path on the CloudFront Distribution.
8.  **Next Visitor** requests the path, hits a CloudFront miss, hits the Next.js origin, which finds an empty S3 cache bucket, forcing a complete server-side re-render of the page with a fresh timestamp.

This solution guarantees cache invalidation while strictly adhering to the requirement of keeping the Next.js application layer clean of direct AWS SDK integrations.

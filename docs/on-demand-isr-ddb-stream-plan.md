# Implementation Plan: Decoupled On-Demand ISR via DynamoDB Streams (No SNS)

## Objective

To completely remove the AWS SDK dependencies from the Next.js application core while simultaneously solving the "competing consumers" issue for On-Demand Incremental Static Regeneration (ISR). This will be achieved by leveraging DynamoDB Streams to detect cache staleness markers created natively by OpenNext, and using a single Stream Processor Lambda to independently send messages to two separate SQS queues (bypassing the need for an SNS Topic).

## Proposed Architecture

1. **Next.js App**: Calls native `revalidatePath(path)`. OpenNext intrinsically updates the `CacheTable` in DynamoDB.
2. **DynamoDB Stream**: Captures changes (`INSERT` or `MODIFY`) to the `CacheTable`.
3. **Stream Processor Lambda**: A lightweight, infrastructure-level Lambda that reads the stream event, extracts the invalidated path, and directly sends two isolated messages:
   - One message to the `RevalidationQueue`
   - One message to the `InvalidationQueue`
4. **SQS Queues**:
   - `RevalidationQueue`: Consumed by the `RevalidationFunction` to regenerate the origin cache.
   - `InvalidationQueue`: Consumed by the `CloudFrontInvalidationFunction` to clear the CDN edge cache.

---

## Step-by-Step Implementation Guide

### Phase 1: Infrastructure Refactoring (`open-next-stack.ts`)

1. **Enable DynamoDB Streams**:
   Update the `CacheTable` definition to enable streaming so infrastructure can react to changes.

   ```typescript
   const cacheTable = new dynamodb.Table(this, "CacheTable", {
     // ... existing props
     stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
   });
   ```

2. **Setup Independent SQS Queues**:
   Replace the single standard SQS queue with two dedicated queues to eliminate the "competing consumers" race condition without needing an SNS Topic.

   ```typescript
   // Create distinct queues
   const revalidationQueue = new sqs.Queue(this, "RevalidationQueue", {
     /* props */
   });
   const invalidationQueue = new sqs.Queue(this, "InvalidationQueue", {
     /* props */
   });
   ```

3. **Provision the Stream Processor Lambda**:
   Create a new Lambda function to act as the glue between the database and the SQS queues.

   ```typescript
   const streamProcessorFunction = new lambda.Function(
     this,
     "StreamProcessorFunction",
     {
       runtime: lambda.Runtime.NODEJS_20_X,
       handler: "index.handler",
       code: lambda.Code.fromAsset(
         path.join(__dirname, "../lambda/stream-processor"),
       ),
       environment: {
         REVALIDATION_QUEUE_URL: revalidationQueue.queueUrl,
         INVALIDATION_QUEUE_URL: invalidationQueue.queueUrl,
       },
     },
   );

   // Grant send message permissions to both queues
   revalidationQueue.grantSendMessages(streamProcessorFunction);
   invalidationQueue.grantSendMessages(streamProcessorFunction);

   // Connect the stream to the processor lambda
   streamProcessorFunction.addEventSource(
     new lambdaEventSources.DynamoEventSource(cacheTable, {
       startingPosition: lambda.StartingPosition.LATEST,
       batchSize: 5,
     }),
   );
   ```

4. **Update Consumer Event Sources**:
   Ensure the `RevalidationFunction` consumes `revalidationQueue` and the `CloudFrontInvalidationFunction` consumes `invalidationQueue`. Also, remove the `REVALIDATION_QUEUE_URL` environment variable from the `ServerFunction` as it will no longer send messages directly.

### Phase 2: Create the Stream Processor Lambda

Create a new directory and handler at `infrastructure/lambda/stream-processor/index.mjs`.

This Lambda will use the Node.js 20.x built-in `@aws-sdk/client-sqs` package (meaning you do not need to bundle it during the CDK build).

**Core Logic:**

1. Iterate over the `event.Records` provided by the DynamoDB stream.
2. Filter for `eventName === 'MODIFY'` or `'INSERT'`.
3. Extract the `path` from the DynamoDB NewImage object.
4. Construct a standardized payload: `JSON.stringify({ url: path, host: "..." })`.
5. Execute two parallel (via `Promise.allSettled`) SQS `SendMessageCommand`s:
   - One to `process.env.REVALIDATION_QUEUE_URL`
   - One to `process.env.INVALIDATION_QUEUE_URL`
6. Important: Implement error handling in the lambda so that if one SQS send fails, it doesn't necessarily crash the whole stream processor (or handles the retry logic gracefully).

### Phase 3: Next.js Application Cleanup

This is the payoff—stripping custom AWS logic out of the Next.js realm.

1. **Refactor `/api/revalidate/route.ts`**:
   Remove all `@aws-sdk/client-sqs` imports, instances of `SQSClient`, and `SendMessageCommand` logic.
   The file should dramatically shrink to just parsing the request body and calling Next.js internals:

   ```typescript
   import { revalidatePath } from "next/cache";
   import { NextRequest, NextResponse } from "next/server";

   export async function POST(request: NextRequest) {
     const { path, type = "page" } = await request.json();
     revalidatePath(path, type);
     return NextResponse.json({ revalidated: true, path });
   }
   ```

2. **Uninstall Dependencies**:
   Run the following to remove the AWS SDK from your React application entirely:
   ```bash
   pnpm remove @aws-sdk/client-sqs
   ```

### Phase 4: Deployment and Verification

1. **Deploy the stack**: Run `pnpm deploy`.
2. **Verify Next.js routing**: Ensure the standard Server-Side Rendering (SSR) functionality continues unabated.
3. **Test On-Demand ISR Validation**:
   - Trigger the `/api/revalidate` endpoint for a specific path.
   - Observe CloudWatch Logs to confirm the following chain reaction:
     1. API Route executes `revalidatePath`.
     2. `StreamProcessorFunction` wakes up, parses the path, and successfully issues two SQS messages.
     3. `RevalidationFunction` successfully regenerates the S3 Cache.
     4. `CloudFrontInvalidationFunction` successfully issues a CDN invalidation request.

This is a [Next.js](https://nextjs.org) project designed to be deployed to AWS using [OpenNext](https://open-next.js.org/) and AWS CDK.

## Architecture Overview

This project uses a serverless architecture on AWS, orchestrated by OpenNext and AWS CDK.

### Core Components

- **Hosting**: AWS Lambda (for SSR/ISR) and S3 (for static assets).
- **CDN**: CloudFront for global content delivery and caching.
- **Image Optimization**: dedicated Lambda function for Next.js image optimization.
- **ISR & Caching**:
  - **DynamoDB**: Stores cache tags and revalidation times.
  - **S3**: Stores cached HTML/JSON responses.
  - **SQS**: Handles revalidation requests asynchronously.
  - **Revalidation Lambda**: Consumes SQS messages to update the cache.
  - **CloudFront Invalidation Lambda**: Triggers CloudFront invalidations when content is revalidated.

### Infrastructure Code

The infrastructure is defined in the `infrastructure/` directory using AWS CDK (TypeScript).

- `infrastructure/lib/open-next-stack.ts`: Defines the AWS resources (CloudFront, Lambda, S3, DynamoDB, SQS).
- `open-next.config.ts`: Configures OpenNext to use the specific AWS adapters (S3, DynamoDB, SQS).

### Detailed Infrastructure Breakdown (`open-next-stack.ts`)

The `OpenNextStack` defines the following resources to power the Next.js application:

#### 1. Storage & Caching

- **`AssetsBucket` (S3)**: Stores static assets (CSS, JS, public folder) and build artifacts. Configured with CORS to allow browser access.
- **`CacheBucket` (S3)**: Dedicated bucket for storing ISR (Incremental Static Regeneration) cached HTML and JSON responses.
- **`CacheTable` (DynamoDB)**: Stores metadata for ISR.
  - **Partition Key**: `tag` (for tag-based revalidation).
  - **Sort Key**: `path` (the route path).
  - **GSIs**:
    - `revalidate-tag`: Allows querying by revalidation tag (critical for `revalidateTag`).
    - `revalidate`: Allows querying by path for traditional ISR.

#### 2. Compute (Lambda Functions)

- **`ServerFunction`**: The main application handler.
  - Runtime: Node.js 20.x.
  - Handles SSR pages, API routes, and initial ISR requests.
  - Has read/write access to both Cache Bucket and Cache Table.
  - Sends revalidation requests to the SQS queue.
- **`ImageOptFunction`**: Handles Next.js Image Optimization (`next/image`).
  - Fetches images from the Assets Bucket, optimizes them, and serves them.
  - Behind a CloudFront cache behavior to cache optimized images.
- **`RevalidationFunction`**: Background worker for ISR.
  - Triggered by the **RevalidationQueue**.
  - Regenerates pages and updates the S3 Cache Bucket and DynamoDB Table.
- **`CloudFrontInvalidationFunction`**:
  - Triggered by the same **RevalidationQueue**.
  - Issues CloudFront invalidations (clearing edge cache) when valid paths are reprocessed, ensuring users see fresh content immediately.

#### 3. Messaging

- **`RevalidationQueue` (SQS)**: Decouples the user request from the revalidation process. When a user triggers a revalidation (or an ISR timeout occurs), a message is sent here. Both the Revalidation Lambda and Invalidation Lambda consume messages from this queue.

#### 4. Content Delivery (CloudFront)

- **`Distribution`**: The entry point for all traffic.
  - **Default Behavior**: Routes to `ServerFunction`.
  - **`_next/static/*`**: Routes to `AssetsBucket` (Long-term caching).
  - **`_next/image*`**: Routes to `ImageOptFunction`.
  - **`_next/data/*`**: Routes to `ServerFunction` (Ensures data requests trigger ISR logic).
  - **Static Files (`*.png`, `*.svg`, etc.)**: Route directly to `AssetsBucket`.

### Why `infrastructure/lambda/revalidation-wrapper.js`?

This file includes a `revalidation-wrapper.js` script in the `infrastructure/lambda` directory.

**Crucially, this file is NOT currently connected to `infrastructure/lib/open-next-stack.ts`.**

It is provided as an **architectural pattern**/template to solve a specific challenge with OpenNext on AWS, which the current "multi-lambda" deployment in `open-next-stack.ts` does not fully address.

#### 1. The Problem: Stale Edge Cache

By default, OpenNext's ISR implementation updates the cached files in S3 and metadata in DynamoDB (the "Origin Cache"). However, it **does not** automatically invalidate the CloudFront CDN cache (the "Edge Cache"). This means users might still see stale content served from the edge until the CloudFront TTL expires, even after a successful revalidation.

#### 2. The Challenge: SQS Competition (Current Stack Issue)

The current `open-next-stack.ts` attempts to fix this by attaching a second Lambda (`CloudFrontInvalidationFunction`) to the same revalidation SQS queue.
However, this introduces a **Race Condition**: SQS standard queues distribute messages to _either_ one consumer or the other, not typically both. This means one Lambda might update the cache (OpenNext) while the other (Invalidation) never sees the message.

#### 3. The `revalidation-wrapper.js` Solution (Recommended Fix)

This script is designed to replace the two separate functions with a single one:

1.  **Wrap** the original OpenNext revalidation handler.
2.  **Execute** the core revalidation logic (updating S3/DynamoDB).
3.  **Invalidate** CloudFront immediately after the update succeeds.

**To use this wrapper**, you would need to modify `open-next-stack.ts` to bundle this script as the handler for the `RevalidationFunction` and remove the separate `CloudFrontInvalidationFunction`.

## Prerequisites

Before deploying, ensure you have the following installed and configured:

1. **Node.js**: Version 20 or higher.
2. **pnpm**: Package manager (`npm install -g pnpm`).
3. **AWS CLI**: Installed and configured with appropriate credentials (`aws configure`).
   - Ensure your default region is set (e.g., `us-east-1`).

## Getting Started

First, install the dependencies:

```bash
pnpm install
```

Run the development server locally:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Deployment

To deploy the application to your AWS account, simply run:

```bash
pnpm deploy
```

This command executes the following steps:

1. **Build**: Runs `open-next build` to bundle the Next.js app for serverless deployment.
2. **Deploy**: Runs `cdk deploy` from the `infrastructure` directory to provision/update AWS resources.

### Manual Deployment Steps

If you want to run the steps manually:

1. Build the application for OpenNext:

   ```bash
   pnpm open-next
   ```

2. Deploy the CDK stack:
   ```bash
   pnpm cdk:deploy
   ```

## Infrastructure Management

### View Outputs

After deployment, the terminal will show important outputs, including:

- `CloudFrontDistributionDomain`: The public URL of your app.
- `RevalidationQueueUrl`: SQS Queue URL for ISR.

### Clean Up

To remove all AWS resources created by this project:

```bash
pnpm cdk:destroy
```

## Application Features

- **SSR (Server-Side Rendering)**: `app/ssr/`
- **SSG (Static Site Generation)**: `app/ssg/`
- **ISR (Incremental Static Regeneration)**: `app/isr/`
- **On-Demand ISR**: `app/isr-on-demand/` (Demonstrates revalidation via API)
- **Edge Runtime**: `app/edge/`
- **Streaming**: `app/streaming/`

## Learn More

- [pnpm Documentation](https://pnpm.io/documentation)
- [OpenNext Documentation](https://open-next.js.org/)
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/latest/guide/home.html)
- [Next.js Documentation](https://nextjs.org/docs)

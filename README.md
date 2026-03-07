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

### On-Demand ISR Workaround (`app/api/revalidate/route.ts`)

For On-Demand ISR (`revalidatePath` / `revalidateTag`), the default OpenNext behavior might not correctly trigger the backend revalidation process in all Next.js versions (specifically v15+).

To address this, `app/api/revalidate/route.ts` implements a manual workaround:

1.  **Calls `revalidatePath()`**: Performs the standard Next.js revalidation call.
2.  **Manually Sends SQS Message**: Explicitly sends a message to the `RevalidationQueue` with the path to be revalidated.

This ensures that the `RevalidationFunction` is reliably triggered to update the cache in S3 and DynamoDB, and subsequently trigger the `CloudFrontInvalidationFunction`.

This requires the `REVALIDATION_QUEUE_URL` environment variable to be available to the server function.

### Potential Issue: Competing Consumers

The current infrastructure configuration in `open-next-stack.ts` sets up a **Standard SQS Queue** (`RevalidationQueue`) with two separate Lambda functions listening to it:

1.  `RevalidationFunction` (Core OpenNext logic)
2.  `CloudFrontInvalidationFunction` (Custom invalidation logic)

This setup creates a **Competing Consumers** pattern. SQS standard queues typically deliver a message to _one_ of the available consumers, not both.

**The Risk:**
There is a potential race condition where:

- A revalidation message is picked up by the `RevalidationFunction`, updating the origin cache (S3/DynamoDB), but the `CloudFrontInvalidationFunction` never receives the message.
- Conversely, the `CloudFrontInvalidationFunction` might pick up the message and invalidate the CDN, but the origin cache remains stale because `RevalidationFunction` never ran.

**Recommended Solution:**
To reliably solve this, the infrastructure should be updated to use an **SNS Fan-out** pattern (SNS Topic -> Multiple SQS Queues) or a single **Chained Execution** Lambda (handling both revalidation and invalidation sequentially). The `revalidation-wrapper.js` (previously removed) was one such attempt at a chained execution solution.

## Learn More

- [pnpm Documentation](https://pnpm.io/documentation)
- [OpenNext Documentation](https://open-next.js.org/)
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/latest/guide/home.html)
- [Next.js Documentation](https://nextjs.org/docs)

# AWS Infrastructure Guide — open-next-demo

> **Who is this for?** This document is written for developers who are comfortable with Next.js but have little or no prior experience with AWS. Every service used in this project is explained in plain language, followed by how it is configured in [`infrastructure/lib/open-next-stack.ts`](../infrastructure/lib/open-next-stack.ts) and why it is needed.

---

## Table of Contents

1. [Big Picture — How It All Fits Together](#1-big-picture--how-it-all-fits-together)
2. [AWS CDK — The Toolbox That Builds Everything](#2-aws-cdk--the-toolbox-that-builds-everything)
3. [Amazon S3 — File Storage](#3-amazon-s3--file-storage)
4. [Amazon DynamoDB — Metadata Database](#4-amazon-dynamodb--metadata-database)
5. [Amazon SQS — Message Queue](#5-amazon-sqs--message-queue)
6. [AWS Lambda — Serverless Functions](#6-aws-lambda--serverless-functions)
7. [Amazon CloudFront — Global CDN](#7-amazon-cloudfront--global-cdn)
8. [AWS IAM — Permissions & Security](#8-aws-iam--permissions--security)
9. [How Next.js Features Map to This Infrastructure](#9-how-nextjs-features-map-to-this-infrastructure)
10. [Request Lifecycle — Step by Step](#10-request-lifecycle--step-by-step)
11. [Environment Variables Reference](#11-environment-variables-reference)
12. [Further Reading](#12-further-reading)

---

## 1. Big Picture — How It All Fits Together

Think of a traditional Next.js deployment on Vercel as a single black box — you push code and it works. This project replaces that black box with **individual, replaceable AWS building blocks**, each responsible for one specific job.

```
  Browser / Mobile App
        │
        ▼
  ┌─────────────────────────────────────────────────────────────┐
  │                    CloudFront (CDN)                         │
  │  Routes requests to the right origin based on URL pattern   │
  └────┬──────────────────────┬───────────────────┬────────────┘
       │                      │                   │
       ▼                      ▼                   ▼
  ┌──────────┐        ┌──────────────┐     ┌────────────┐
  │  S3      │        │   Lambda     │     │   Lambda   │
  │ (Static  │        │  (Server     │     │  (Image    │
  │  Files)  │        │   Function)  │     │   Opt.)    │
  └──────────┘        └──────┬───────┘     └────────────┘
                             │
               ┌─────────────┼─────────────┐
               ▼             ▼             ▼
          ┌──────────┐ ┌──────────┐ ┌──────────┐
          │   S3     │ │DynamoDB  │ │   SQS    │
          │ (Cache)  │ │ (Cache   │ │ (Queue)  │
          │          │ │ Metadata)│ │          │
          └──────────┘ └──────────┘ └────┬─────┘
                                         │
                              ┌──────────┴──────────┐
                              ▼                     ▼
                       ┌────────────┐      ┌─────────────────┐
                       │Revalidation│      │CloudFront       │
                       │  Lambda    │      │Invalidation     │
                       │            │      │Lambda           │
                       └────────────┘      └─────────────────┘
```

Each box above is an AWS service. The rest of this document explains each one.

---

## 2. AWS CDK — The Toolbox That Builds Everything

### What is it?

**AWS CDK (Cloud Development Kit)** is a framework that lets you write infrastructure code in TypeScript (or Python, Java, Go, etc.) instead of clicking through the AWS console. When you run `cdk deploy`, it reads your TypeScript code, converts it to a CloudFormation template, and creates/updates all the AWS resources for you automatically.

📖 **Reference**: [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/v2/guide/home.html)

### Where is it in the code?

The entire `infrastructure/lib/open-next-stack.ts` file is the CDK stack. The class `OpenNextStack` extends `cdk.Stack`, which is the top-level container for all AWS resources.

```typescript
// infrastructure/lib/open-next-stack.ts
export class OpenNextStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    // All AWS resources are defined inside here
  }
}
```

### Why is it used?

Without CDK, you would have to manually create each service through the AWS web console — a slow, error-prone, and non-reproducible process. CDK lets you version-control your infrastructure alongside your application code.

---

## 3. Amazon S3 — File Storage

### What is it?

**S3 (Simple Storage Service)** is AWS's object storage service. Think of it as a **hard drive in the cloud** — you can store any file (HTML, JavaScript, images, JSON) and retrieve it via a URL. It is highly durable (99.999999999% durability), scales infinitely, and is very cheap (cents per GB per month).

📖 **Reference**: [Amazon S3 Documentation](https://docs.aws.amazon.com/s3/index.html)

### Key concept: **Buckets & Objects**

- A **Bucket** is like a top-level folder (you own it, it has a globally unique name).
- An **Object** is a file inside the bucket (identified by its "key", which is basically its file path).

---

### 3.1 `AssetsBucket` — Static Files

```typescript
// infrastructure/lib/open-next-stack.ts (line 19)
const assetsBucket = new s3.Bucket(this, "AssetsBucket", {
  removalPolicy: cdk.RemovalPolicy.DESTROY,
  autoDeleteObjects: true,
  cors: [
    {
      allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD],
      allowedOrigins: ["*"],
      allowedHeaders: ["*"],
    },
  ],
});
```

| Setting                   | What it means                                                                            |
| ------------------------- | ---------------------------------------------------------------------------------------- |
| `removalPolicy: DESTROY`  | When you run `cdk destroy`, this bucket is also deleted. Good for dev/demo environments. |
| `autoDeleteObjects: true` | S3 normally refuses to delete non-empty buckets. This auto-empties it before deletion.   |
| `cors`                    | Allows browsers from any origin to read files directly (needed for fonts, images, etc.). |

**What is stored here?**

- All compiled JavaScript bundles (`_next/static/chunks/...`)
- CSS files
- Public folder files (images, fonts you placed in `/public`)
- Pre-rendered SSG/ISR page HTML files at build time

**How files get here:**

```typescript
// infrastructure/lib/open-next-stack.ts (line 144)
new s3deploy.BucketDeployment(this, "DeployAssets", {
  sources: [s3deploy.Source.asset("../../.open-next/assets")],
  destinationBucket: assetsBucket,
  cacheControl: [
    s3deploy.CacheControl.setPublic(),
    s3deploy.CacheControl.maxAge(cdk.Duration.days(365)), // Cache for 1 year
  ],
});
```

The `BucketDeployment` CDK construct uploads files from `.open-next/assets` (produced by `open-next build`) into the bucket. Static assets get a **365-day cache header** because they have content-hashed filenames — if the file changes, the filename changes too, so long caching is safe.

```typescript
// infrastructure/lib/open-next-stack.ts (line 156)
new s3deploy.BucketDeployment(this, "DeployCache", {
  sources: [s3deploy.Source.asset("../../.open-next/cache")],
  destinationBucket: assetsBucket,
  cacheControl: [
    s3deploy.CacheControl.maxAge(cdk.Duration.seconds(0)), // Never cache
  ],
});
```

Pre-rendered cache files get **0 seconds cache** because they will be replaced by the ISR process.

---

### 3.2 `CacheBucket` — ISR Cache Storage

```typescript
// infrastructure/lib/open-next-stack.ts (line 32)
const cacheBucket = new s3.Bucket(this, "CacheBucket", {
  removalPolicy: cdk.RemovalPolicy.DESTROY,
  autoDeleteObjects: true,
});
```

**What is stored here?**

This is OpenNext's private cache store. When the `RevalidationFunction` regenerates an ISR page, it writes the resulting HTML and JSON back into this bucket. On subsequent requests, the `ServerFunction` reads directly from here instead of re-running the page logic.

| File type | Example key      | Description                        |
| --------- | ---------------- | ---------------------------------- |
| HTML      | `isr/index.html` | The rendered HTML of the page      |
| RSC       | `isr/index.rsc`  | React Server Component payload     |
| JSON      | `isr/index.json` | Data payload for client navigation |

> **Analogy**: If `AssetsBucket` is your app's source code files, `CacheBucket` is like a notebook where the server writes "I already computed this page — here's the result." On the next request, it reads from the notebook instead of recalculating.

---

## 4. Amazon DynamoDB — Metadata Database

### What is it?

**DynamoDB** is AWS's fully managed **NoSQL database**. Unlike a traditional SQL database (PostgreSQL, MySQL), DynamoDB stores data as flexible key-value or document items. It scales automatically and requires zero server management.

📖 **Reference**: [Amazon DynamoDB Documentation](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/)

### Key concepts

- **Table**: Like a SQL table, but schema-free (except for the key fields).
- **Partition Key (PK)**: The main lookup key. Think of it as a primary key.
- **Sort Key (SK)**: A secondary key that allows range queries within a partition.
- **GSI (Global Secondary Index)**: An additional index that lets you query by a _different_ key than the primary PK/SK combination.

---

### The `CacheTable`

```typescript
// infrastructure/lib/open-next-stack.ts (line 38)
const cacheTable = new dynamodb.Table(this, "CacheTable", {
  partitionKey: { name: "tag", type: dynamodb.AttributeType.STRING },
  sortKey: { name: "path", type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  timeToLiveAttribute: "expireAt",
  removalPolicy: cdk.RemovalPolicy.DESTROY,
});
```

**What is stored here?**

Each row tracks the relationship between a **cache tag** and a **page path**. When `revalidateTag('products')` is called, DynamoDB is queried for all paths that were tagged with `'products'`, so they can all be invalidated at once.

| Attribute       | Type   | Example         | Description                           |
| --------------- | ------ | --------------- | ------------------------------------- |
| `tag` (PK)      | String | `"_N_T_/isr"`   | The cache tag or internal Next.js tag |
| `path` (SK)     | String | `"/isr"`        | The page route path                   |
| `revalidatedAt` | Number | `1741234567000` | Unix timestamp of last revalidation   |
| `expireAt`      | Number | `1741320967`    | Unix timestamp for TTL auto-deletion  |

**Billing mode: PAY_PER_REQUEST**
Unlike `PROVISIONED` mode where you pre-allocate capacity, `PAY_PER_REQUEST` scales automatically and you only pay for the actual read/write operations. This is ideal for variable-traffic applications.

**TTL (Time To Live): `expireAt`**
DynamoDB can automatically delete expired items. The `expireAt` attribute holds a Unix timestamp, and DynamoDB deletes items after that time. This prevents the table from growing indefinitely with stale cache metadata.

---

### Global Secondary Indexes (GSIs)

```typescript
// infrastructure/lib/open-next-stack.ts (line 47)
// GSI 1: Query by tag (for revalidateTag)
cacheTable.addGlobalSecondaryIndex({
  indexName: "revalidate-tag",
  partitionKey: { name: "tag", type: dynamodb.AttributeType.STRING },
  projectionType: dynamodb.ProjectionType.ALL,
});

// GSI 2: Query by path (for revalidatePath)
cacheTable.addGlobalSecondaryIndex({
  indexName: "revalidate",
  partitionKey: { name: "path", type: dynamodb.AttributeType.STRING },
  sortKey: { name: "revalidatedAt", type: dynamodb.AttributeType.NUMBER },
  projectionType: dynamodb.ProjectionType.ALL,
});
```

**Why are GSIs needed?**

The main table's PK is `tag` and SK is `path`. This lets you look up "what paths have this tag?" efficiently. But sometimes you need the reverse — "what tags does this path have?" — which is what the GSIs provide.

| Index                | Can answer quickly                                                            |
| -------------------- | ----------------------------------------------------------------------------- |
| Main table           | "Give me all paths tagged `products`"                                         |
| `revalidate-tag` GSI | "Give me all items for tag `blog`" (used by `revalidateTag()`)                |
| `revalidate` GSI     | "Give me the last revalidation time for path `/isr`" (used by time-based ISR) |

`projectionType: ALL` means the GSI copies all attributes from the main table, so queries don't need an extra read to fetch the full item.

---

## 5. Amazon SQS — Message Queue

### What is it?

**SQS (Simple Queue Service)** is a fully managed message queuing service. Think of it like a **bulletin board**: one process posts a note ("please revalidate /isr"), and one or more other processes pick up the note and act on it. The bulletin board (queue) stores the note safely until someone reads it.

📖 **Reference**: [Amazon SQS Documentation](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/)

### Why use a queue instead of calling Lambda directly?

| Problem                                                         | SQS Solution                                                                |
| --------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Revalidation could spike during traffic bursts                  | SQS buffers requests and processes them at a steady rate                    |
| Lambda invocations can fail                                     | SQS retries messages automatically until they succeed                       |
| You want to decouple the web request from the regeneration work | The web request returns immediately; revalidation happens in the background |

---

### The Two Queues

#### `RevalidationQueue`

```typescript
// infrastructure/lib/open-next-stack.ts (line 61)
const revalidationQueue = new sqs.Queue(this, "RevalidationQueue", {
  visibilityTimeout: cdk.Duration.seconds(30),
  receiveMessageWaitTime: cdk.Duration.seconds(20),
  removalPolicy: cdk.RemovalPolicy.DESTROY,
});
```

**Purpose**: Triggers the `RevalidationFunction` to **regenerate a stale page** and write fresh HTML to S3/DynamoDB.

#### `InvalidationQueue`

```typescript
// infrastructure/lib/open-next-stack.ts (line 67)
const invalidationQueue = new sqs.Queue(this, "InvalidationQueue", {
  visibilityTimeout: cdk.Duration.seconds(30),
  receiveMessageWaitTime: cdk.Duration.seconds(20),
  removalPolicy: cdk.RemovalPolicy.DESTROY,
});
```

**Purpose**: Triggers the `CloudFrontInvalidationFunction` to **purge stale cached responses from CloudFront's edge servers** worldwide.

| Setting                       | What it means                                                                                                                                                                                                                                |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `visibilityTimeout: 30s`      | After a Lambda picks up a message, the message is hidden from other Lambdas for 30 seconds. If the Lambda doesn't finish in time (and delete the message), the message becomes visible again for retry. This should be ≥ the Lambda timeout. |
| `receiveMessageWaitTime: 20s` | **Long polling** — instead of immediately returning empty if the queue has no messages, the Lambda waits up to 20 seconds for a new message. This reduces unnecessary API calls and costs.                                                   |

> **Why two separate queues?** Originally, there was one queue shared by both functions. This caused a **competing consumers** race condition — SQS delivers each message to only _one_ consumer, so sometimes the `RevalidationFunction` got the message (but CloudFront wasn't cleared), and sometimes the `CloudFrontInvalidationFunction` got it (but the origin cache wasn't refreshed). Two dedicated queues ensure **both** functions always receive the event.

---

## 6. AWS Lambda — Serverless Functions

### What is it?

**AWS Lambda** lets you run code **without provisioning or managing any servers**. You upload your code, define a trigger (HTTP request, SQS message, DynamoDB stream), and AWS runs it on demand. You pay only for the milliseconds your code executes. Lambda functions automatically scale from zero to thousands of concurrent invocations.

📖 **Reference**: [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/latest/dg/)

### Key concepts

- **Handler**: The entry point function in your code (always `index.handler` here).
- **Runtime**: The language/version. All functions here use `NODEJS_20_X`.
- **Memory**: Allocated RAM. More memory = more CPU = faster execution (and higher cost).
- **Timeout**: Maximum execution time. Lambda kills the function if it exceeds this.
- **Environment Variables**: Key-value config injected at runtime (like `.env` files).
- **Function URL**: A public HTTPS endpoint that directly invokes a Lambda (no API Gateway needed).

---

### 6.1 `ServerFunction` — The Main Next.js Application

```typescript
// infrastructure/lib/open-next-stack.ts (line 74)
const serverFunction = new lambda.Function(this, "ServerFunction", {
  runtime: lambda.Runtime.NODEJS_20_X,
  handler: "index.handler",
  code: lambda.Code.fromAsset("../../.open-next/server-functions/default"),
  memorySize: 1024, // 1 GB RAM
  timeout: cdk.Duration.seconds(30),
  environment: {
    CACHE_BUCKET_NAME: cacheBucket.bucketName,
    CACHE_BUCKET_REGION: this.region,
    CACHE_DYNAMO_TABLE: cacheTable.tableName,
    REVALIDATION_QUEUE_URL: revalidationQueue.queueUrl,
    REVALIDATION_QUEUE_REGION: this.region,
    WEBHOOK_URL: "", // Filled in later
  },
});
```

**What it does**: This is your entire Next.js app running inside a Lambda function. OpenNext bundles the Next.js server into a Lambda-compatible handler. It processes:

- **SSR pages** — renders React components on the server and returns HTML
- **API Routes** (`app/api/...`) — handles server-side business logic
- **ISR page requests** — checks DynamoDB/S3, serves cached content or triggers revalidation
- **Middleware** — runs Next.js middleware before routing

**Why 1024 MB?** Next.js server rendering is CPU-intensive. Lambda shares CPU proportionally with memory, so 1 GB RAM gives roughly 2x the CPU compared to 512 MB, making SSR noticeably faster.

**Permissions granted:**

```typescript
cacheBucket.grantReadWrite(serverFunction); // Read/write cached pages
cacheTable.grantReadWriteData(serverFunction); // Read/write cache metadata
revalidationQueue.grantSendMessages(serverFunction); // Enqueue revalidation jobs
```

**Function URL:**

```typescript
const serverFunctionUrl = serverFunction.addFunctionUrl({
  authType: lambda.FunctionUrlAuthType.NONE, // Public — CloudFront controls access
});
```

This creates a public `https://<id>.lambda-url.<region>.on.aws/` endpoint that CloudFront uses as the origin for all dynamic requests.

---

### 6.2 `ImageOptFunction` — Next.js Image Optimization

```typescript
// infrastructure/lib/open-next-stack.ts (line 117)
const imageOptFunction = new lambda.Function(this, "ImageOptFunction", {
  runtime: lambda.Runtime.NODEJS_20_X,
  handler: "index.handler",
  code: lambda.Code.fromAsset("../../.open-next/image-optimization-function"),
  memorySize: 2048, // 2 GB RAM — image processing is CPU-heavy
  timeout: cdk.Duration.seconds(30),
  environment: {
    BUCKET_NAME: assetsBucket.bucketName,
    CACHE_BUCKET_NAME: assetsBucket.bucketName,
    CACHE_BUCKET_REGION: this.region,
  },
});
```

**What it does**: Handles requests to `/_next/image?url=...&w=...&q=...`. When you use `<Image>` from `next/image` in your JSX, Next.js generates these URLs. This Lambda:

1. Fetches the original image from `AssetsBucket` (or from a remote URL)
2. Resizes it to the requested width
3. Converts it to the most efficient format supported by the browser (WebP, AVIF, etc.)
4. Returns the optimized image

**Why 2048 MB?** Image resizing/encoding is very CPU-bound. 2 GB gives the function enough compute power to process images in a reasonable time.

---

### 6.3 `RevalidationFunction` — ISR Background Worker

```typescript
// infrastructure/lib/open-next-stack.ts (line 313)
const revalidationFunction = new lambda.Function(this, "RevalidationFunction", {
  runtime: lambda.Runtime.NODEJS_20_X,
  handler: "index.handler",
  code: lambda.Code.fromAsset("../../.open-next/revalidation-function"),
  memorySize: 512,
  timeout: cdk.Duration.seconds(30),
  environment: {
    CACHE_DYNAMO_TABLE: cacheTable.tableName,
    CACHE_BUCKET_NAME: cacheBucket.bucketName,
    CACHE_BUCKET_REGION: this.region,
    REVALIDATION_QUEUE_URL: revalidationQueue.queueUrl,
    REVALIDATION_QUEUE_REGION: this.region,
  },
});

// Wire it up to read from the Revalidation Queue
revalidationFunction.addEventSource(
  new lambdaEventSources.SqsEventSource(revalidationQueue, { batchSize: 5 }),
);
```

**What it does**: This is OpenNext's built-in background worker (the code comes from `.open-next/revalidation-function`). When a message arrives in `RevalidationQueue`, this function:

1. Reads the path from the message (e.g., `/isr`)
2. Re-executes the Next.js page component (calling `fetch`, database queries, etc.)
3. Writes the fresh HTML/JSON back to `CacheBucket`
4. Updates the `revalidatedAt` timestamp in `CacheTable`

**`batchSize: 5`** — The function can process up to 5 SQS messages per invocation, reducing Lambda invocation overhead during bursts.

---

### 6.4 `CloudFrontInvalidationFunction` — CDN Cache Purging

```typescript
// infrastructure/lib/open-next-stack.ts (line 362)
const cloudfrontInvalidationFunction = new lambda.Function(
  this,
  "CloudFrontInvalidationFunction",
  {
    runtime: lambda.Runtime.NODEJS_20_X,
    handler: "index.handler",
    code: lambda.Code.fromAsset("../lambda/cloudfront-invalidation"),
    memorySize: 256,
    timeout: cdk.Duration.seconds(30),
    environment: {
      CLOUDFRONT_DISTRIBUTION_ID: distribution.distributionId,
    },
  },
);

// Grant permission to issue CloudFront invalidations
cloudfrontInvalidationFunction.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ["cloudfront:CreateInvalidation"],
    resources: [
      `arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`,
    ],
  }),
);

// Wire it up to read from the Invalidation Queue
cloudfrontInvalidationFunction.addEventSource(
  new lambdaEventSources.SqsEventSource(invalidationQueue, {
    batchSize: 5,
    reportBatchItemFailures: true,
  }),
);
```

**What it does**: When a message arrives in `InvalidationQueue`, this function calls the CloudFront API to issue a **cache invalidation** for the given path. This tells all ~600 CloudFront edge locations worldwide to stop serving their locally cached version and re-fetch from the origin (Lambda or S3).

Without invalidation, CloudFront could serve stale content from its edge cache for hours, even after the origin cache (S3) was already refreshed by `RevalidationFunction`.

**`reportBatchItemFailures: true`** — If one path fails to invalidate, only that specific message is retried, not the whole batch.

---

### 6.5 `WebhookFunction` — External Invalidation Trigger

```typescript
// infrastructure/lib/open-next-stack.ts (line 408)
const webhookFunction = new lambda.Function(this, "WebhookFunction", {
  runtime: lambda.Runtime.NODEJS_20_X,
  handler: "index.handler",
  code: lambda.Code.fromAsset("../lambda/webhook"),
  environment: {
    INVALIDATION_QUEUE_URL: invalidationQueue.queueUrl,
    CACHE_BUCKET_NAME: cacheBucket.bucketName,
  },
  memorySize: 256,
  timeout: cdk.Duration.seconds(30),
});

const webhookFunctionUrl = webhookFunction.addFunctionUrl({
  authType: lambda.FunctionUrlAuthType.NONE,
  cors: {
    allowedOrigins: ["*"],
    allowedMethods: [lambda.HttpMethod.POST],
  },
});

// Inject the webhook URL back into the Server Function
serverFunction.addEnvironment("WEBHOOK_URL", webhookFunctionUrl.url);
```

**What it does**: Provides a public HTTPS endpoint (via Function URL with CORS) that external systems (like a CMS) can call to trigger on-demand cache invalidation. The code in [`infrastructure/lambda/webhook/index.mjs`](../infrastructure/lambda/webhook/index.mjs):

1. Validates the incoming request has a `path` field
2. Deletes the stale cached files from `CacheBucket` directly (because `revalidatePath` alone sometimes misses S3 entries)
3. Sends a message to `InvalidationQueue` to also purge CloudFront edges

The webhook URL is then injected into the `ServerFunction` environment as `WEBHOOK_URL`, allowing the `/api/revalidate` route to call it internally.

---

### 6.6 `StreamProcessorFunction` (Planned / Documented)

Described in [`docs/on-demand-isr-ddb-stream-plan.md`](./on-demand-isr-ddb-stream-plan.md), this future Lambda reads directly from the **DynamoDB Stream** on the `CacheTable`. Whenever OpenNext writes a revalidation marker to DynamoDB, this Lambda fires and sends messages to **both** queues simultaneously — eliminating the need for the `ServerFunction` to call the AWS SDK directly.

See [`infrastructure/lambda/stream-processor/index.mjs`](../infrastructure/lambda/stream-processor/index.mjs) for the implementation.

---

## 7. Amazon CloudFront — Global CDN

### What is it?

**CloudFront** is AWS's **Content Delivery Network (CDN)**. A CDN is a globally distributed network of servers (called **edge locations** or **Points of Presence / PoPs**) that cache your content close to your users. Instead of every request traveling to a server in (for example) `ap-southeast-1`, a user in Germany fetches a cached copy from a Frankfurt edge server.

CloudFront has **600+ edge locations** around the world.

📖 **Reference**: [Amazon CloudFront Documentation](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/)

### Key concepts

- **Distribution**: The top-level CloudFront resource with a domain like `d1234abcd.cloudfront.net`.
- **Origin**: Where CloudFront fetches content from when it doesn't have a cache hit (S3 bucket or Lambda URL).
- **Behavior**: A routing rule that maps a URL pattern to an origin and cache policy.
- **Cache Policy**: Rules that decide what request attributes (headers, query strings, cookies) are part of the cache key.
- **OAI (Origin Access Identity)**: A special identity that allows CloudFront to read from a private S3 bucket without making the bucket public.

---

### The Distribution and Its Behaviors

```typescript
// infrastructure/lib/open-next-stack.ts (line 200)
const distribution = new cloudfront.Distribution(this, "Distribution", {
  defaultBehavior: {
    /* → ServerFunction Lambda */
  },
  additionalBehaviors: {
    "_next/static/*": {
      /* → AssetsBucket S3 */
    },
    "_next/image*": {
      /* → ImageOptFunction Lambda */
    },
    "_next/data/*": {
      /* → ServerFunction Lambda */
    },
    "*.svg": {
      /* → AssetsBucket S3 */
    },
    "*.ico": {
      /* → AssetsBucket S3 */
    },
    "*.png": {
      /* → AssetsBucket S3 */
    },
    "*.jpg": {
      /* → AssetsBucket S3 */
    },
    "*.webp": {
      /* → AssetsBucket S3 */
    },
  },
});
```

CloudFront matches behaviors from **most specific to least specific**. Here's the routing table:

| URL Pattern            | Origin              | Why                                            |
| ---------------------- | ------------------- | ---------------------------------------------- |
| `/_next/static/*`      | `AssetsBucket` (S3) | Compiled JS/CSS — immutable, cached for 1 year |
| `/_next/image*`        | `ImageOptFunction`  | Next.js image optimization                     |
| `/_next/data/*`        | `ServerFunction`    | ISR data payloads for client-side navigation   |
| `*.svg`, `*.png`, etc. | `AssetsBucket` (S3) | Public folder static files                     |
| `*` (everything else)  | `ServerFunction`    | All pages, API routes — default fallback       |

---

### Cache Policies

#### Server Cache Policy

```typescript
// infrastructure/lib/open-next-stack.ts (line 177)
const serverCachePolicy = new cloudfront.CachePolicy(
  this,
  "ServerCachePolicy",
  {
    queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
    headerBehavior: cloudfront.CacheHeaderBehavior.allowList(
      "accept",
      "rsc",
      "next-router-prefetch",
      "next-router-state-tree",
      "next-router-segment-prefetch",
      "next-url",
    ),
    cookieBehavior: cloudfront.CacheCookieBehavior.none(),
    defaultTtl: cdk.Duration.seconds(0),
    maxTtl: cdk.Duration.days(365),
    minTtl: cdk.Duration.seconds(0),
    enableAcceptEncodingGzip: true,
    enableAcceptEncodingBrotli: true,
  },
);
```

| Setting       | Value                         | Reason                                                                      |
| ------------- | ----------------------------- | --------------------------------------------------------------------------- |
| Query strings | All included                  | `?page=2`, `?filter=red` etc. must produce different cache entries          |
| Headers       | Only specific Next.js headers | The `rsc`, `next-router-*` headers distinguish RSC payloads from full HTML  |
| Cookies       | None                          | Cookies are not part of the cache key (stateless pages)                     |
| Default TTL   | 0 seconds                     | By default, CloudFront defers to the `Cache-Control` header from the origin |
| Max TTL       | 365 days                      | App can set very long headers for static-ish content                        |
| Gzip + Brotli | Enabled                       | Compressed responses save bandwidth and are faster to transfer              |

#### Why the specific Next.js headers?

The `rsc` header is sent by the Next.js router when it's doing a **client-side navigation** and only needs the React Server Component payload (not the full HTML). Without this in the cache key, a client-side navigation might receive a full HTML page instead of the RSC fragment, causing errors.

---

### OAI (Origin Access Identity)

```typescript
// infrastructure/lib/open-next-stack.ts (line 168)
const oai = new cloudfront.OriginAccessIdentity(this, "OAI");
assetsBucket.grantRead(oai);

const s3Origin = new origins.S3Origin(assetsBucket, {
  originAccessIdentity: oai,
});
```

The `AssetsBucket` is **not public**. Without OAI, anyone knowing the S3 URL could read files directly, bypassing CloudFront. OAI creates a special CloudFront identity that is granted read access to the bucket — only CloudFront can read from S3, ensuring all traffic goes through your CDN.

---

### Viewer Protocol Policy

Every behavior has:

```typescript
viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
```

This means if a browser requests `http://...`, CloudFront automatically redirects to `https://...`. This is applied globally across all behaviors.

---

## 8. AWS IAM — Permissions & Security

### What is it?

**IAM (Identity and Access Management)** is AWS's permissions system. Every AWS operation must be explicitly authorized. No Lambda can read from S3 unless it has been granted that specific permission. This is the **principle of least privilege** — each component gets only the permissions it needs.

📖 **Reference**: [AWS IAM Documentation](https://docs.aws.amazon.com/IAM/latest/UserGuide/)

### Permission grants in this stack

```typescript
// infrastructure/lib/open-next-stack.ts

// ServerFunction permissions
cacheBucket.grantReadWrite(serverFunction); // Read/write ISR cache files
cacheTable.grantReadWriteData(serverFunction); // Read/write DynamoDB metadata
revalidationQueue.grantSendMessages(serverFunction); // Send ISR jobs to SQS

// Also grant explicit Query permission on GSIs (CDK's grantReadWriteData doesn't cover GSIs)
serverFunction.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ["dynamodb:Query"],
    resources: [
      `${cacheTable.tableArn}/index/revalidate`,
      `${cacheTable.tableArn}/index/revalidate-tag`,
    ],
  }),
);

// RevalidationFunction permissions
cacheBucket.grantReadWrite(revalidationFunction);
cacheTable.grantReadWriteData(revalidationFunction);
revalidationQueue.grantConsumeMessages(revalidationFunction); // Read & delete messages from SQS

// CloudFrontInvalidationFunction permissions
cloudfrontInvalidationFunction.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ["cloudfront:CreateInvalidation"],
    resources: [
      `arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`,
    ],
  }),
);

// WebhookFunction permissions
invalidationQueue.grantSendMessages(webhookFunction);
cacheBucket.grantReadWrite(webhookFunction);
```

> **Important Note**: CDK's convenience methods like `grantReadWrite()` and `grantConsumeMessages()` automatically create the correct IAM policies. However, GSI query permissions are not included in DynamoDB's managed policies, so they need to be added manually via `addToRolePolicy`.

---

## 9. How Next.js Features Map to This Infrastructure

This section explains exactly how each Next.js rendering strategy is handled by the AWS infrastructure above.

### 9.1 SSR — Server-Side Rendering (`app/ssr/`)

**What it is**: The page is rendered on the server on every request. No caching at the origin level.

**Infrastructure flow**:

```
User Request
  → CloudFront (cache miss — SSR is never cached at this layer)
  → ServerFunction Lambda
      → Runs the async React component
      → Returns fresh HTML
  → CloudFront forwards response to user
```

- CloudFront's `defaultTtl: 0` means it respects `Cache-Control: no-store` or similar headers that SSR pages emit.
- Every request hits the `ServerFunction`.

---

### 9.2 SSG — Static Site Generation (`app/ssg/`)

**What it is**: The page is pre-rendered at build time once. The result is a static HTML file.

**Infrastructure flow**:

```
Build time:
  open-next build → generates HTML → CDK deploys to AssetsBucket

User Request:
  → CloudFront (behavior: default → ServerFunction)
  → ServerFunction reads pre-built HTML from CacheBucket (S3)
  → Returns HTML
  → CloudFront caches it based on Cache-Control header
```

- The pre-rendered HTML is uploaded to `CacheBucket` during `cdk deploy`.
- The `ServerFunction` serves it as-is on first request.
- CloudFront can then cache it at the edge for subsequent requests.

---

### 9.3 ISR — Time-Based Incremental Static Regeneration (`app/isr/`)

**What it is**: Like SSG, but the page is regenerated automatically after a time interval (e.g., `revalidate: 60` = every 60 seconds).

**Infrastructure flow**:

```
Request during valid cache window:
  → CloudFront → ServerFunction → reads from CacheBucket → fast response

After revalidation window expires:
  → CloudFront → ServerFunction
  → ServerFunction checks DynamoDB: "is this stale?"
  → Serves the stale page immediately (good UX)
  → Sends message to RevalidationQueue
      → RevalidationFunction wakes up
      → Rerenders the page
      → Writes new HTML to CacheBucket
      → Updates revalidatedAt in DynamoDB
      → CloudFrontInvalidationFunction purges edge cache
```

This is the classic **stale-while-revalidate** pattern. The user is never left waiting for revalidation. The `expireAt` TTL on DynamoDB rows lets old metadata clean itself up.

---

### 9.4 On-Demand ISR — Triggered Revalidation (`app/isr-on-demand/`)

**What it is**: Revalidation is triggered explicitly by calling `revalidatePath()` or `revalidateTag()` from an API route.

**Current implementation flow** (`app/api/revalidate/route.ts`):

```
POST /api/revalidate { path: "/isr-on-demand" }
  → CloudFront → ServerFunction
  → revalidatePath("/isr-on-demand") called
      → OpenNext updates DynamoDB (marks path as stale)
      → OpenNext sends message to RevalidationQueue directly
  → (Workaround) ServerFunction also directly sends message to RevalidationQueue
      → RevalidationFunction regenerates the page
      → CloudFrontInvalidationFunction (via InvalidationQueue) purges edge cache
  → 200 OK response
```

> **Why the manual workaround?** In Next.js 15, OpenNext's internal `revalidatePath()` sometimes doesn't reliably trigger the SQS message. The manual SDK call in `app/api/revalidate/route.ts` is an explicit guarantee that the job is always queued.

**Planned DDB Stream flow** (see [`on-demand-isr-ddb-stream-plan.md`](./on-demand-isr-ddb-stream-plan.md)):

```
POST /api/revalidate { path: "/isr-on-demand" }
  → revalidatePath() → DynamoDB write
  → DynamoDB Stream fires → StreamProcessorFunction
      → Sends to RevalidationQueue AND InvalidationQueue in parallel
  → RevalidationFunction regenerates
  → CloudFrontInvalidationFunction purges edge cache
```

This cleaner approach removes all AWS SDK code from the Next.js app itself.

---

### 9.5 Edge Runtime (`app/edge/`)

**What it is**: Pages/routes configured with `export const runtime = 'edge'` run in a lightweight V8 isolate instead of a full Node.js process. They start faster (near-zero cold start) but have limited Node.js API access.

**OpenNext config:**

```typescript
// open-next.config.ts
functions: {
  edgePage: {
    runtime: "edge",
    routes: ["app/edge/page"],
    patterns: ["/edge"],
  },
}
```

**Infrastructure**: Edge functions in OpenNext are deployed as **Lambda@Edge** or **CloudFront Functions**, running in CloudFront's edge locations rather than a central region. Requests to `/edge` never need to travel to the origin Lambda — they are handled at the nearest PoP.

---

### 9.6 Streaming (`app/streaming/`)

**What it is**: React `Suspense` combined with Next.js streaming sends HTML to the browser in chunks as it's ready, instead of waiting for the entire page to render. Users see content faster.

**Infrastructure**: Streaming is supported by the `ServerFunction` Lambda + Function URL combination. Lambda Function URLs support **response streaming** via the `RESPONSE_STREAM` invocation mode, which OpenNext uses. CloudFront then forwards the chunked response to the browser.

---

### 9.7 Middleware

```typescript
// open-next.config.ts
middleware: {
  external: true,
},
```

**What it is**: Next.js Middleware runs before a request reaches the page, allowing you to redirect, rewrite, add headers, etc.

**`external: true`**: OpenNext deploys middleware as a separate, lightweight function (a CloudFront Function or Lambda@Edge) that runs at the edge, before the request even hits the `ServerFunction`. This is more efficient than including it in the main server bundle.

---

## 10. Request Lifecycle — Step by Step

Here is a complete trace of what happens for a few common scenarios:

### Scenario A: First visit to an ISR page

```
1. Browser: GET https://d1234.cloudfront.net/isr
2. CloudFront: Cache miss — forwards to origin
3. ServerFunction: Receives request
   a. Checks DynamoDB: "Is /isr fresh?" → No cached entry
   b. Renders the page (runs async getData(), etc.)
   c. Writes HTML to CacheBucket (S3)
   d. Writes metadata to CacheTable (DynamoDB)
   e. Returns HTML with Cache-Control header
4. CloudFront: Caches the response at the edge
5. Browser: Receives HTML, renders page
```

### Scenario B: Subsequent visit (within cache window)

```
1. Browser: GET https://d1234.cloudfront.net/isr
2. CloudFront: Cache hit — returns cached HTML immediately
3. Browser: Fast response, no Lambda invoked
```

### Scenario C: ISR revalidation (time expired)

```
1. Browser: GET https://d1234.cloudfront.net/isr
2. CloudFront: Cache may be stale — forwards to origin
3. ServerFunction:
   a. Checks DynamoDB: "Is /isr stale?" → Yes
   b. Returns stale HTML immediately (good UX!)
   c. Sends {url: "/isr"} message to RevalidationQueue (SQS)
4. RevalidationFunction (async, triggered by SQS):
   a. Fetches fresh data
   b. Renders updated HTML
   c. Writes to CacheBucket
   d. Updates DynamoDB revalidatedAt
5. CloudFrontInvalidationFunction (async, triggered by InvalidationQueue):
   a. Calls cloudfront:CreateInvalidation for /isr
   b. All 600+ edge PoPs drop their cached copy
6. Next request: CloudFront re-fetches from ServerFunction, caches new HTML
```

### Scenario D: On-demand ISR via POST /api/revalidate

```
1. CMS publishes new content
2. POST https://d1234.cloudfront.net/api/revalidate { "path": "/isr-on-demand" }
3. CloudFront → ServerFunction (API route handler)
4. revalidatePath("/isr-on-demand") called
5. Manual SQS send to RevalidationQueue
6. RevalidationFunction: Re-renders page, updates S3 + DynamoDB
7. InvalidationQueue → CloudFrontInvalidationFunction: Purges edge cache
8. Next visit: Users see fresh content
```

---

## 11. Environment Variables Reference

These are injected into Lambda functions and control how OpenNext adapters connect to AWS services:

| Variable                     | Used by                                               | Description                                         |
| ---------------------------- | ----------------------------------------------------- | --------------------------------------------------- |
| `CACHE_BUCKET_NAME`          | ServerFunction, RevalidationFunction, WebhookFunction | Name of `CacheBucket` for reading/writing ISR cache |
| `CACHE_BUCKET_REGION`        | ServerFunction, RevalidationFunction                  | AWS region where `CacheBucket` resides              |
| `CACHE_DYNAMO_TABLE`         | ServerFunction, RevalidationFunction                  | Name of `CacheTable` for cache metadata             |
| `REVALIDATION_QUEUE_URL`     | ServerFunction, RevalidationFunction                  | SQS URL for enqueueing revalidation jobs            |
| `REVALIDATION_QUEUE_REGION`  | ServerFunction, RevalidationFunction                  | AWS region of `RevalidationQueue`                   |
| `INVALIDATION_QUEUE_URL`     | WebhookFunction, StreamProcessorFunction              | SQS URL for enqueueing CloudFront invalidation jobs |
| `CLOUDFRONT_DISTRIBUTION_ID` | CloudFrontInvalidationFunction                        | The distribution to invalidate                      |
| `CACHE_BUCKET_NAME`          | WebhookFunction                                       | For direct S3 cache deletion                        |
| `WEBHOOK_URL`                | ServerFunction                                        | URL of the `WebhookFunction` Function URL           |

---

## 12. Further Reading

| Topic                                               | Link                                                                                                                                                                                               |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **OpenNext** — The adapter that makes this possible | [open-next.js.org](https://open-next.js.org/)                                                                                                                                                      |
| **AWS CDK v2 Guide**                                | [docs.aws.amazon.com/cdk/v2/guide](https://docs.aws.amazon.com/cdk/v2/guide/home.html)                                                                                                             |
| **Amazon S3**                                       | [docs.aws.amazon.com/s3](https://docs.aws.amazon.com/s3/index.html)                                                                                                                                |
| **Amazon DynamoDB** — Developer Guide               | [docs.aws.amazon.com/amazondynamodb](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/)                                                                                            |
| **Amazon SQS** — Developer Guide                    | [docs.aws.amazon.com/AWSSimpleQueueService](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/)                                                                           |
| **AWS Lambda** — Developer Guide                    | [docs.aws.amazon.com/lambda](https://docs.aws.amazon.com/lambda/latest/dg/)                                                                                                                        |
| **Amazon CloudFront** — Developer Guide             | [docs.aws.amazon.com/AmazonCloudFront](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/)                                                                                        |
| **AWS IAM** — User Guide                            | [docs.aws.amazon.com/IAM](https://docs.aws.amazon.com/IAM/latest/UserGuide/)                                                                                                                       |
| **Next.js ISR documentation**                       | [nextjs.org/docs/app/building-your-application/data-fetching/incremental-static-regeneration](https://nextjs.org/docs/app/building-your-application/data-fetching/incremental-static-regeneration) |
| **Next.js Caching documentation**                   | [nextjs.org/docs/app/building-your-application/caching](https://nextjs.org/docs/app/building-your-application/caching)                                                                             |

---

_Document maintained alongside [`infrastructure/lib/open-next-stack.ts`](../infrastructure/lib/open-next-stack.ts). Update this file whenever the infrastructure changes._

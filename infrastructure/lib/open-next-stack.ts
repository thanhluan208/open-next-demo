import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import { Construct } from "constructs";
import * as path from "path";
import * as fs from "fs";
// experimental is required for EdgeFunction (Lambda@Edge)
import { experimental } from "aws-cdk-lib/aws-cloudfront";

// ── Stack Props ───────────────────────────────────────────────────────────────
// serverFunctionUrlHost is only known after the first deployment.
// Deploy in two passes:
//   Pass 1: cdk deploy OpenNextStack
//           → Capture the ServerFunctionUrl output host
//   Pass 2: cdk deploy OpenNextStack --context serverFunctionUrlHost=<host>
//           → Patches Lambda@Edge middleware bundle with the real origin URL
interface OpenNextStackProps extends cdk.StackProps {
  serverFunctionUrlHost?: string;
}

export class OpenNextStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: OpenNextStackProps) {
    super(scope, id, props);

    // ── S3 Bucket for static assets ──────────────────────────────────────────
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

    // ── S3 Bucket for ISR cache ───────────────────────────────────────────────
    const cacheBucket = new s3.Bucket(this, "CacheBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // ── DynamoDB table for ISR tag cache ─────────────────────────────────────
    // Schema: { tag (PK), path (SK) }
    // OpenNext uses this to track which cache entries need revalidation
    // when revalidateTag() is called.
    const cacheTable = new dynamodb.Table(this, "CacheTable", {
      partitionKey: { name: "tag", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "path", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "expireAt",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // GSI required by OpenNext to query all paths for a given tag
    cacheTable.addGlobalSecondaryIndex({
      indexName: "revalidate-tag",
      partitionKey: { name: "tag", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI required for checking if a path was revalidated
    cacheTable.addGlobalSecondaryIndex({
      indexName: "revalidate",
      partitionKey: { name: "path", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "revalidatedAt", type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ── SQS FIFO Queue for ISR revalidation ───────────────────────────────────
    // MUST be FIFO — OpenNext's SQS adapter requires it.
    // Standard queues cause out-of-order delivery and race conditions.
    const revalidationQueue = new sqs.Queue(this, "RevalidationQueue", {
      fifo: true,
      contentBasedDeduplication: true,
      visibilityTimeout: cdk.Duration.seconds(30),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ── SQS Standard Queue for CloudFront invalidations ──────────────────────
    // Triggered by the webhook when revalidatePath() is called explicitly.
    const invalidationQueue = new sqs.Queue(this, "InvalidationQueue", {
      visibilityTimeout: cdk.Duration.seconds(30),
      receiveMessageWaitTime: cdk.Duration.seconds(20),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ── Server Lambda function ────────────────────────────────────────────────
    // Handles all SSR, ISR, and API routes. Built by OpenNext at:
    //   .open-next/server-functions/default/
    const serverFunction = new lambda.Function(this, "ServerFunction", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(
        path.join(__dirname, "../../.open-next/server-functions/default"),
        {
          followSymlinks: cdk.SymlinkFollowMode.ALWAYS,
        },
      ),
      memorySize: 1024,
      timeout: cdk.Duration.seconds(30),
      environment: {
        CACHE_BUCKET_NAME: cacheBucket.bucketName,
        CACHE_BUCKET_REGION: this.region,
        CACHE_DYNAMO_TABLE: cacheTable.tableName,
        REVALIDATION_QUEUE_URL: revalidationQueue.queueUrl,
        REVALIDATION_QUEUE_REGION: this.region,
        // WEBHOOK_URL is injected after webhookFunction is created below
        WEBHOOK_URL: "",
      },
    });

    // Grant permissions to server function
    cacheBucket.grantReadWrite(serverFunction);
    cacheTable.grantReadWriteData(serverFunction);
    revalidationQueue.grantSendMessages(serverFunction);

    // Allow querying the GSI
    serverFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:Query"],
        resources: [
          `${cacheTable.tableArn}/index/revalidate-tag`,
          `${cacheTable.tableArn}/index/revalidate`,
        ],
      }),
    );

    // Create Function URL — used as CloudFront origin
    const serverFunctionUrl = serverFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
    });

    // ── Patch Lambda@Edge middleware bundle ────────────────────────────────────
    // Lambda@Edge has NO environment variables. OpenNext's middleware bundle
    // reads OPEN_NEXT_ORIGIN at runtime to know where to forward requests.
    // Since we can't pass env vars, we patch the hardcoded value into the
    // bundle at CDK synth time.
    //
    // IMPORTANT: This requires a two-pass deployment:
    //   Pass 1: Deploy without context → gets server function URL
    //   Pass 2: Deploy with --context serverFunctionUrlHost=<host>
    //           → patches bundle and redeploys edge function
    const knownHost = props?.serverFunctionUrlHost ?? "";

    const middlewareFilePath = path.join(
      __dirname,
      "../../.open-next/middleware/handler.mjs",
    );

    if (fs.existsSync(middlewareFilePath)) {
      let code = fs.readFileSync(middlewareFilePath, "utf-8");

      let patched = false;

      // 1. Patch OPEN_NEXT_ORIGIN if known
      if (knownHost && !code.includes("__PATCHED_ORIGIN__")) {
        const origin = JSON.stringify({
          default: { host: knownHost, protocol: "https" },
        });
        code = code.replace(
          `ze = JSON.parse(process.env.OPEN_NEXT_ORIGIN ?? "{}")`,
          `ze = JSON.parse(process.env.OPEN_NEXT_ORIGIN ?? '${origin}') /* __PATCHED_ORIGIN__ */`,
        );
        console.log(`✅ Patched middleware origin → ${knownHost}`);
        patched = true;
      }

      // 2. Fix Node 20 / ES module `process` object immutability error in Edge Functions
      // Error: TypeError: Cannot assign to read only property 'env' of object '[object Module]'
      if (!code.includes("__PATCHED_ENV__")) {
        code = code.replace(
          `process!==t.g.process&&(process.env=t.g.process.env,t.g.process=process)`,
          `process!==t.g.process&&(Object.assign(process.env??{}, t.g.process.env),t.g.process=process) /* __PATCHED_ENV__ */`,
        );
        code = code.replace(
          `process.env=t.g.process.env,t.g.process=process`,
          `Object.assign(process.env??{}, t.g.process.env),t.g.process=process /* __PATCHED_ENV__ */`,
        );
        console.log(`✅ Patched Edge middleware immutability fix`);
        patched = true;
      }

      if (patched) {
        fs.writeFileSync(middlewareFilePath, code);
      } else {
        console.log(`ℹ️  Middleware already patched, skipping`);
      }
    } else {
      console.warn(
        `⚠️  Middleware bundle not found at ${middlewareFilePath}. ` +
          `Run 'npx open-next build' first.`,
      );
    }

    if (!knownHost) {
      console.warn(
        "\n⚠️  WARNING: serverFunctionUrlHost not provided.\n" +
          "   Lambda@Edge middleware cannot resolve origin → requests will 500.\n" +
          "   This is expected on Pass 1. After deploying, run:\n" +
          "   cdk deploy --context serverFunctionUrlHost=<your-lambda-url-host>\n",
      );
    }

    // ── Lambda@Edge for Next.js Middleware ────────────────────────────────────
    // Runs at the nearest CloudFront PoP on every viewer request.
    // Built by OpenNext (middleware.external: true) at:
    //   .open-next/middleware/handler.mjs
    //
    // EVENT TYPE: ViewerRequest
    //   → Runs BEFORE CloudFront cache check (even on cache hits)
    //   → Max 5s timeout, no env vars, must be in us-east-1
    //   → Handles auth checks, redirects, rewrites, A/B testing
    const middlewareEdgeFunction = new experimental.EdgeFunction(
      this,
      "MiddlewareEdgeFunction",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "handler.handler",
        code: lambda.Code.fromAsset(
          path.join(__dirname, "../../.open-next/middleware"),
        ),
        memorySize: 128,
        timeout: cdk.Duration.seconds(5),
        description:
          "Next.js middleware @ CloudFront edge (OpenNext external middleware)",
      },
    );

    // ── Image Optimization Lambda ─────────────────────────────────────────────
    const imageOptFunction = new lambda.Function(this, "ImageOptFunction", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(
        path.join(__dirname, "../../.open-next/image-optimization-function"),
        {
          followSymlinks: cdk.SymlinkFollowMode.ALWAYS,
        },
      ),
      memorySize: 2048,
      timeout: cdk.Duration.seconds(30),
      environment: {
        BUCKET_NAME: assetsBucket.bucketName,
        CACHE_BUCKET_NAME: assetsBucket.bucketName,
        CACHE_BUCKET_REGION: this.region,
      },
    });

    assetsBucket.grantRead(imageOptFunction);

    const imageOptFunctionUrl = imageOptFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
    });

    // ── Deploy static assets to S3 ────────────────────────────────────────────
    new s3deploy.BucketDeployment(this, "DeployAssets", {
      sources: [
        s3deploy.Source.asset(path.join(__dirname, "../../.open-next/assets")),
      ],
      destinationBucket: assetsBucket,
      cacheControl: [
        s3deploy.CacheControl.setPublic(),
        s3deploy.CacheControl.maxAge(cdk.Duration.days(365)),
      ],
    });

    // ── Deploy pre-rendered pages (ISR cache) to S3 ───────────────────────────
    // Goes to cacheBucket (not assetsBucket) — server function reads from here
    new s3deploy.BucketDeployment(this, "DeployCache", {
      sources: [
        s3deploy.Source.asset(path.join(__dirname, "../../.open-next/cache")),
      ],
      destinationBucket: cacheBucket,
      cacheControl: [
        s3deploy.CacheControl.setPublic(),
        s3deploy.CacheControl.maxAge(cdk.Duration.seconds(0)),
      ],
    });

    // ── CloudFront Origin Access Identity for S3 ──────────────────────────────
    const oai = new cloudfront.OriginAccessIdentity(this, "OAI");
    assetsBucket.grantRead(oai);

    const s3Origin = new origins.S3Origin(assetsBucket, {
      originAccessIdentity: oai,
    });

    // ── Custom Origin Request Policy ──────────────────────────────────────────
    // CRITICAL: Lambda@Edge (VIEWER_REQUEST) mutates the request and adds
    // x-opennext-* headers. CloudFront's managed "AllViewerExceptHostHeader"
    // policy only forwards ORIGINAL viewer headers — NOT headers added by
    // Lambda@Edge. Without this custom policy, the server function never
    // receives x-opennext-resolved-routes and falls into NoFallbackError → 500.
    const serverOriginRequestPolicy = new cloudfront.OriginRequestPolicy(
      this,
      "ServerOriginRequestPolicy",
      {
        originRequestPolicyName: `ServerOriginRequestPolicy-${this.stackName}`,
        headerBehavior: cloudfront.OriginRequestHeaderBehavior.allowList(
          "accept-language",
          "x-opennext-initial-url",
          "x-opennext-resolved-routes",
          "x-opennext-rewrite-status-code",
          "x-opennext-request-id",
          "x-opennext-locale",
          "next-action",
          "x-prerender-revalidate",
          "x-middleware-prefetch",
          "cloudfront-viewer-country",
        ),
        cookieBehavior: cloudfront.OriginRequestCookieBehavior.all(),
        queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.all(),
      },
    );

    // ── Cache Policy for SSR/ISR routes ───────────────────────────────────────
    const serverCachePolicy = new cloudfront.CachePolicy(
      this,
      "ServerCachePolicy",
      {
        cachePolicyName: `ServerCachePolicy-${this.stackName}`,
        queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
        headerBehavior: cloudfront.CacheHeaderBehavior.allowList(
          "accept",
          "rsc",
          "next-router-prefetch",
          "next-router-state-tree",
          "next-router-segment-prefetch",
          "next-url",
          // Required for OpenNext middleware header passthrough
          "x-op-middleware-request-headers",
          "x-op-middleware-response-headers",
        ),
        cookieBehavior: cloudfront.CacheCookieBehavior.none(),
        defaultTtl: cdk.Duration.seconds(0),
        maxTtl: cdk.Duration.days(365),
        minTtl: cdk.Duration.seconds(0),
        enableAcceptEncodingGzip: true,
        enableAcceptEncodingBrotli: true,
      },
    );

    // ── CloudFront Distribution ───────────────────────────────────────────────
    const distribution = new cloudfront.Distribution(this, "Distribution", {
      defaultBehavior: {
        origin: new origins.HttpOrigin(
          cdk.Fn.select(2, cdk.Fn.split("/", serverFunctionUrl.url)),
        ),
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: serverCachePolicy,
        originRequestPolicy: serverOriginRequestPolicy,
        edgeLambdas: [
          {
            functionVersion: middlewareEdgeFunction.currentVersion,
            eventType: cloudfront.LambdaEdgeEventType.VIEWER_REQUEST,
            // Required for POST bodies (Server Actions, form submissions)
            includeBody: true,
          },
        ],
      },
      additionalBehaviors: {
        // Static assets — long cache, served from S3, skip middleware
        "_next/static/*": {
          origin: s3Origin,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },

        // Image optimization — served from Lambda
        "_next/image*": {
          origin: new origins.HttpOrigin(
            cdk.Fn.select(2, cdk.Fn.split("/", imageOptFunctionUrl.url)),
          ),
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: new cloudfront.CachePolicy(this, "ImageCachePolicy", {
            cachePolicyName: `ImageCachePolicy-${this.stackName}`,
            queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
            headerBehavior: cloudfront.CacheHeaderBehavior.allowList("Accept"),
            cookieBehavior: cloudfront.CacheCookieBehavior.none(),
            defaultTtl: cdk.Duration.days(1),
            maxTtl: cdk.Duration.days(365),
            minTtl: cdk.Duration.seconds(0),
            enableAcceptEncodingGzip: true,
            enableAcceptEncodingBrotli: true,
          }),
          originRequestPolicy:
            cloudfront.OriginRequestPolicy.fromOriginRequestPolicyId(
              this,
              "ImageOriginRequestPolicy",
              "b689b0a8-53d0-40ab-baf2-68738e2966ac",
            ),
        },

        // ISR/SSG data routes — must hit server function
        "_next/data/*": {
          origin: new origins.HttpOrigin(
            cdk.Fn.select(2, cdk.Fn.split("/", serverFunctionUrl.url)),
          ),
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: serverCachePolicy,
          originRequestPolicy: serverOriginRequestPolicy,
        },

        // Static file types — served from S3
        "*.svg": {
          origin: s3Origin,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
        "*.ico": {
          origin: s3Origin,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
        "*.png": {
          origin: s3Origin,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
        "*.jpg": {
          origin: s3Origin,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
        "*.webp": {
          origin: s3Origin,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
      },
    });

    // ── Revalidation Lambda ───────────────────────────────────────────────────
    // Consumes messages from revalidationQueue (SQS FIFO).
    // Makes a HEAD request with x-prerender-revalidate to regenerate stale pages.
    const revalidationFunction = new lambda.Function(
      this,
      "RevalidationFunction",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "index.handler",
        code: lambda.Code.fromAsset(
          path.join(__dirname, "../../.open-next/revalidation-function"),
          {
            followSymlinks: cdk.SymlinkFollowMode.ALWAYS,
          },
        ),
        memorySize: 512,
        timeout: cdk.Duration.seconds(30),
        environment: {
          CACHE_DYNAMO_TABLE: cacheTable.tableName,
          CACHE_BUCKET_NAME: cacheBucket.bucketName,
          CACHE_BUCKET_REGION: this.region,
          REVALIDATION_QUEUE_URL: revalidationQueue.queueUrl,
          REVALIDATION_QUEUE_REGION: this.region,
        },
      },
    );

    cacheBucket.grantReadWrite(revalidationFunction);
    cacheTable.grantReadWriteData(revalidationFunction);
    revalidationQueue.grantConsumeMessages(revalidationFunction);

    revalidationFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:Query"],
        resources: [
          `${cacheTable.tableArn}/index/revalidate-tag`,
          `${cacheTable.tableArn}/index/revalidate`,
        ],
      }),
    );

    revalidationFunction.addEventSource(
      new lambdaEventSources.SqsEventSource(revalidationQueue, {
        batchSize: 5,
      }),
    );

    // ── CloudFront Invalidation Lambda ────────────────────────────────────────
    // Listens to invalidationQueue and calls CloudFront CreateInvalidation.
    // Triggered when the webhook receives a revalidatePath() notification.
    const cloudfrontInvalidationFunction = new lambda.Function(
      this,
      "CloudFrontInvalidationFunction",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "index.handler",
        code: lambda.Code.fromAsset(
          path.join(__dirname, "../lambda/cloudfront-invalidation"),
          {
            bundling: {
              image: lambda.Runtime.NODEJS_20_X.bundlingImage,
              command: [
                "bash",
                "-c",
                "npm install --omit=dev && cp -r . /asset-output/",
              ],
            },
          },
        ),
        memorySize: 256,
        timeout: cdk.Duration.seconds(30),
        environment: {
          CLOUDFRONT_DISTRIBUTION_ID: distribution.distributionId,
        },
      },
    );

    cloudfrontInvalidationFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["cloudfront:CreateInvalidation"],
        resources: [
          `arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`,
        ],
      }),
    );

    cloudfrontInvalidationFunction.addEventSource(
      new lambdaEventSources.SqsEventSource(invalidationQueue, {
        batchSize: 5,
        reportBatchItemFailures: true,
      }),
    );

    // ── Webhook Lambda ────────────────────────────────────────────────────────
    // Public HTTP endpoint called by the Next.js server when revalidatePath()
    // is invoked. Enqueues a CloudFront invalidation message.
    const webhookFunction = new lambda.Function(this, "WebhookFunction", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambda/webhook")),
      environment: {
        INVALIDATION_QUEUE_URL: invalidationQueue.queueUrl,
        CACHE_BUCKET_NAME: cacheBucket.bucketName,
      },
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
    });

    invalidationQueue.grantSendMessages(webhookFunction);
    cacheBucket.grantReadWrite(webhookFunction);

    const webhookFunctionUrl = webhookFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ["*"],
        allowedMethods: [lambda.HttpMethod.POST],
      },
    });

    // Inject webhook URL into server function after it's been created
    serverFunction.addEnvironment("WEBHOOK_URL", webhookFunctionUrl.url);

    // ── Stack Outputs ─────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, "DistributionUrl", {
      value: `https://${distribution.distributionDomainName}`,
      description: "CloudFront Distribution URL",
    });

    new cdk.CfnOutput(this, "DistributionDomain", {
      value: distribution.distributionDomainName,
      description: "CloudFront Distribution Domain",
    });

    new cdk.CfnOutput(this, "DistributionId", {
      value: distribution.distributionId,
      description: "CloudFront Distribution ID",
    });

    new cdk.CfnOutput(this, "AssetsBucketName", {
      value: assetsBucket.bucketName,
      description: "S3 Assets Bucket Name",
    });

    new cdk.CfnOutput(this, "CacheBucketName", {
      value: cacheBucket.bucketName,
      description: "S3 ISR Cache Bucket Name",
    });

    new cdk.CfnOutput(this, "CacheTableName", {
      value: cacheTable.tableName,
      description: "DynamoDB Cache Table Name",
    });

    new cdk.CfnOutput(this, "RevalidationQueueUrl", {
      value: revalidationQueue.queueUrl,
      description: "SQS Revalidation Queue URL (FIFO)",
    });

    // IMPORTANT: Used by Pass 2 deployment to patch Lambda@Edge middleware
    new cdk.CfnOutput(this, "ServerFunctionUrl", {
      value: serverFunctionUrl.url,
      description:
        "Lambda Server Function URL — use the host for serverFunctionUrlHost context",
    });

    new cdk.CfnOutput(this, "WebhookUrl", {
      value: webhookFunctionUrl.url,
      description: "Webhook Function URL for revalidatePath() notifications",
    });
  }
}

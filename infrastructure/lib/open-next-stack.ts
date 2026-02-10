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

export class OpenNextStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 Bucket for static assets
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

    // S3 Bucket for ISR cache
    const cacheBucket = new s3.Bucket(this, "CacheBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // DynamoDB table for ISR cache
    const cacheTable = new dynamodb.Table(this, "CacheTable", {
      partitionKey: { name: "tag", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "path", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "expireAt",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // CRITICAL: GSI for querying by tag alone (for revalidateTag)
    cacheTable.addGlobalSecondaryIndex({
      indexName: "revalidate-tag",
      partitionKey: { name: "tag", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI for path-based revalidation queries
    cacheTable.addGlobalSecondaryIndex({
      indexName: "revalidate",
      partitionKey: { name: "path", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "revalidatedAt", type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const revalidationQueue = new sqs.Queue(this, "RevalidationQueue", {
      visibilityTimeout: cdk.Duration.seconds(30),
      receiveMessageWaitTime: cdk.Duration.seconds(20),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Server Lambda function
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
      },
    });

    // Grant permissions
    cacheBucket.grantReadWrite(serverFunction);
    cacheTable.grantReadWriteData(serverFunction);
    revalidationQueue.grantSendMessages(serverFunction);

    // Allow querying the GSIs
    serverFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:Query"],
        resources: [
          `${cacheTable.tableArn}/index/revalidate`,
          `${cacheTable.tableArn}/index/revalidate-tag`,
        ],
      }),
    );

    // Create Function URL
    const serverFunctionUrl = serverFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
    });

    // Image Optimization Lambda
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

    // Grant permissions
    assetsBucket.grantRead(imageOptFunction);

    // Create Function URL
    const imageOptFunctionUrl = imageOptFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
    });

    // Deploy static assets to S3
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

    // Deploy cache (pre-rendered pages) to S3
    new s3deploy.BucketDeployment(this, "DeployCache", {
      sources: [
        s3deploy.Source.asset(path.join(__dirname, "../../.open-next/cache")),
      ],
      destinationBucket: assetsBucket,
      cacheControl: [
        s3deploy.CacheControl.setPublic(),
        s3deploy.CacheControl.maxAge(cdk.Duration.seconds(0)),
      ],
    });

    // CloudFront Origin Access Identity for S3
    const oai = new cloudfront.OriginAccessIdentity(this, "OAI");
    assetsBucket.grantRead(oai);

    // S3 Origin for static assets
    const s3Origin = new origins.S3Origin(assetsBucket, {
      originAccessIdentity: oai,
    });

    // Cache Policy for the Server (SSR/ISR)
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

    // CloudFront distribution
    const distribution = new cloudfront.Distribution(this, "Distribution", {
      defaultBehavior: {
        origin: new origins.HttpOrigin(
          cdk.Fn.select(2, cdk.Fn.split("/", serverFunctionUrl.url)),
        ),
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: serverCachePolicy,
        originRequestPolicy:
          cloudfront.OriginRequestPolicy.fromOriginRequestPolicyId(
            this,
            "AllViewerExceptHostHeader",
            "b689b0a8-53d0-40ab-baf2-68738e2966ac",
          ),
      },
      additionalBehaviors: {
        // _next/static files MUST come first (most specific)
        "_next/static/*": {
          origin: s3Origin,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },

        // _next/image optimization
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

        // _next/data for ISR/SSG - MUST go to server function for revalidation
        "_next/data/*": {
          origin: new origins.HttpOrigin(
            cdk.Fn.select(2, cdk.Fn.split("/", serverFunctionUrl.url)),
          ),
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: serverCachePolicy,
          originRequestPolicy:
            cloudfront.OriginRequestPolicy.fromOriginRequestPolicyId(
              this,
              "DataOriginRequestPolicy",
              "b689b0a8-53d0-40ab-baf2-68738e2966ac",
            ),
        },

        // Specific static files
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

    // Revalidation Lambda (created after CloudFront distribution)
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

    // Grant permissions
    cacheBucket.grantReadWrite(revalidationFunction);
    cacheTable.grantReadWriteData(revalidationFunction);
    revalidationQueue.grantConsumeMessages(revalidationFunction);

    // Allow querying the GSIs
    revalidationFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:Query"],
        resources: [
          `${cacheTable.tableArn}/index/revalidate`,
          `${cacheTable.tableArn}/index/revalidate-tag`,
        ],
      }),
    );

    // Connect SQS to revalidation function
    revalidationFunction.addEventSource(
      new lambdaEventSources.SqsEventSource(revalidationQueue, {
        batchSize: 5,
      }),
    );

    // CloudFront Invalidation Lambda
    // This function listens to the same SQS queue and invalidates CloudFront cache
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

    // Grant CloudFront invalidation permissions
    cloudfrontInvalidationFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["cloudfront:CreateInvalidation"],
        resources: [
          `arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`,
        ],
      }),
    );

    // Connect SQS to CloudFront invalidation function
    cloudfrontInvalidationFunction.addEventSource(
      new lambdaEventSources.SqsEventSource(revalidationQueue, {
        batchSize: 5,
        reportBatchItemFailures: true,
      }),
    );

    // Outputs
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

    new cdk.CfnOutput(this, "CacheTableName", {
      value: cacheTable.tableName,
      description: "DynamoDB Cache Table Name",
    });

    new cdk.CfnOutput(this, "RevalidationQueueUrl", {
      value: revalidationQueue.queueUrl,
      description: "SQS Revalidation Queue URL",
    });
  }
}

import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
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
      partitionKey: { name: "path", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "tag", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "expireAt",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Add GSI for revalidation
    cacheTable.addGlobalSecondaryIndex({
      indexName: "revalidate",
      partitionKey: { name: "path", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "revalidatedAt", type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Server Lambda function
    const serverFunction = new lambda.Function(this, "ServerFunction", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(
        path.join(__dirname, "../../.open-next/server-functions/default"),
        {
          // Tell CDK to follow symlinks - this resolves pnpm issues
          followSymlinks: cdk.SymlinkFollowMode.ALWAYS,
        },
      ),
      memorySize: 1024,
      timeout: cdk.Duration.seconds(30),
      environment: {
        CACHE_BUCKET_NAME: cacheBucket.bucketName,
        CACHE_DYNAMO_TABLE: cacheTable.tableName,
      },
    });

    // Grant permissions
    cacheBucket.grantReadWrite(serverFunction);
    cacheTable.grantReadWriteData(serverFunction);

    // Allow querying the revalidate index
    serverFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:Query"],
        resources: [`${cacheTable.tableArn}/index/revalidate`],
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
          // Tell CDK to follow symlinks - this resolves pnpm issues
          followSymlinks: cdk.SymlinkFollowMode.ALWAYS,
        },
      ),
      memorySize: 2048,
      timeout: cdk.Duration.seconds(30),
      environment: {
        BUCKET_NAME: assetsBucket.bucketName,
      },
    });

    // Grant permissions
    assetsBucket.grantRead(imageOptFunction);

    // Create Function URL
    const imageOptFunctionUrl = imageOptFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
    });

    // Revalidation Lambda
    const revalidationFunction = new lambda.Function(
      this,
      "RevalidationFunction",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "index.handler",
        code: lambda.Code.fromAsset(
          path.join(__dirname, "../../.open-next/revalidation-function"),
          {
            // Tell CDK to follow symlinks - this resolves pnpm issues
            followSymlinks: cdk.SymlinkFollowMode.ALWAYS,
          },
        ),
        memorySize: 512,
        timeout: cdk.Duration.seconds(30),
        environment: {
          CACHE_DYNAMO_TABLE: cacheTable.tableName,
        },
      },
    );

    // Grant permissions
    cacheTable.grantReadWriteData(revalidationFunction);

    // Create Function URL
    const revalidationFunctionUrl = revalidationFunction.addFunctionUrl({
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

    // CloudFront distribution
    const distribution = new cloudfront.Distribution(this, "Distribution", {
      defaultBehavior: {
        origin: new origins.HttpOrigin(
          cdk.Fn.select(2, cdk.Fn.split("/", serverFunctionUrl.url)),
        ),
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy:
          cloudfront.OriginRequestPolicy.fromOriginRequestPolicyId(
            this,
            "AllViewerExceptHostHeader",
            "b689b0a8-53d0-40ab-baf2-68738e2966ac",
          ),
      },
      additionalBehaviors: {
        "_next/static/*": {
          origin: new origins.S3Origin(assetsBucket, {
            originAccessIdentity: oai,
          }),
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
        "_next/image*": {
          origin: new origins.HttpOrigin(
            cdk.Fn.select(2, cdk.Fn.split("/", imageOptFunctionUrl.url)),
          ),
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: new cloudfront.CachePolicy(this, "ImageCachePolicy", {
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
        "_next/data/*": {
          origin: new origins.S3Origin(assetsBucket, {
            originAccessIdentity: oai,
          }),
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        },
      },
    });

    // Outputs
    new cdk.CfnOutput(this, "DistributionUrl", {
      value: `https://${distribution.distributionDomainName}`,
      description: "CloudFront Distribution URL",
    });

    new cdk.CfnOutput(this, "DistributionDomain", {
      value: distribution.distributionDomainName,
      description: "CloudFront Distribution Domain",
    });

    new cdk.CfnOutput(this, "AssetsBucketName", {
      value: assetsBucket.bucketName,
      description: "S3 Assets Bucket Name",
    });

    new cdk.CfnOutput(this, "CacheTableName", {
      value: cacheTable.tableName,
      description: "DynamoDB Cache Table Name",
    });
  }
}

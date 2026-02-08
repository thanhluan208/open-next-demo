# AWS Deployment Tasks - Detailed Breakdown

This document provides step-by-step tasks for deploying the Next.js application to AWS using @opennextjs/aws and CDK.

---

## Phase 1: Prerequisites Setup

### Task 1.1: Install AWS CDK CLI globally

**Guidance:**

```bash
npm install -g aws-cdk
```

**Expected Output:**

- CDK CLI installed globally
- Verify with: `cdk --version`
- Should show version 2.x.x

**Status:** [ ]

---

### Task 1.2: Bootstrap CDK in AWS Account

**Guidance:**

```bash
cdk bootstrap aws://708676091124/ap-southeast-1
```

**Expected Output:**

- CloudFormation stack `CDKToolkit` created in AWS
- S3 bucket for CDK assets created (name: `cdk-hnb659fds-assets-708676091124-ap-southeast-1`)
- IAM roles for CDK deployment created
- Success message: "✅ Environment aws://708676091124/ap-southeast-1 bootstrapped"

**Status:** [ ]

---

## Phase 2: Project Dependencies

### Task 2.1: Install @opennextjs/aws package

**Guidance:**

```bash
cd /Users/dangthanhluan/works/open-next-demo
pnpm add -D @opennextjs/aws
```

**Expected Output:**

- `@opennextjs/aws` added to `devDependencies` in `package.json`
- Version should be ^3.9.0 or higher
- `pnpm-lock.yaml` updated

**Status:** [ ]

---

### Task 2.2: Create infrastructure package directory

**Guidance:**

```bash
mkdir infrastructure
cd infrastructure
pnpm init
```

**Expected Output:**

- Directory `infrastructure/` created
- File `infrastructure/package.json` created with basic structure

**Status:** [ ]

---

### Task 2.3: Install CDK dependencies in infrastructure package

**Guidance:**

```bash
cd infrastructure
pnpm add aws-cdk-lib constructs
pnpm add -D @types/node typescript
```

**Expected Output:**

- `aws-cdk-lib` and `constructs` added to dependencies
- `@types/node` and `typescript` added to devDependencies
- `infrastructure/package.json` updated
- `infrastructure/node_modules/` created

**Status:** [ ]

---

### Task 2.4: Update pnpm workspace configuration

**Guidance:**
Edit `pnpm-workspace.yaml` to add:

```yaml
packages:
  - "infrastructure"

ignoredBuiltDependencies:
  - sharp
  - unrs-resolver
```

**Expected Output:**

- `pnpm-workspace.yaml` includes `infrastructure` package
- Running `pnpm install` at root recognizes the workspace

**Status:** [ ]

---

## Phase 3: Next.js Configuration

### Task 3.1: Update next.config.ts for OpenNext

**Guidance:**
Edit `next.config.ts`:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
};

export default nextConfig;
```

**Expected Output:**

- `next.config.ts` updated with `output: 'standalone'`
- Image optimization configuration added
- File saved successfully

**Status:** [ ]

---

### Task 3.2: Create open-next.config.ts

**Guidance:**
Create `open-next.config.ts` in project root:

```typescript
import type { OpenNextConfig } from "@opennextjs/aws";

const config: OpenNextConfig = {
  default: {
    override: {
      wrapper: "aws-lambda-streaming",
    },
  },
  middleware: {
    external: true,
  },
};

export default config;
```

**Expected Output:**

- File `open-next.config.ts` created in root directory
- Configuration for Lambda streaming and middleware set up

**Status:** [ ]

---

### Task 3.3: Add deployment scripts to root package.json

**Guidance:**
Edit `package.json` to add scripts:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "open-next": "open-next build",
    "cdk:synth": "cd infrastructure && cdk synth",
    "cdk:deploy": "cd infrastructure && cdk deploy",
    "cdk:destroy": "cd infrastructure && cdk destroy",
    "deploy": "pnpm open-next && pnpm cdk:deploy"
  }
}
```

**Expected Output:**

- Scripts added to `package.json`
- Can run `pnpm open-next`, `pnpm cdk:synth`, etc.

**Status:** [ ]

---

## Phase 4: CDK Infrastructure Setup

### Task 4.1: Create infrastructure TypeScript configuration

**Guidance:**
Create `infrastructure/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["es2020"],
    "declaration": true,
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": false,
    "inlineSourceMap": true,
    "inlineSources": true,
    "experimentalDecorators": true,
    "strictPropertyInitialization": false,
    "typeRoots": ["./node_modules/@types"],
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "exclude": ["node_modules", "cdk.out"]
}
```

**Expected Output:**

- File `infrastructure/tsconfig.json` created
- TypeScript configuration for CDK set up

**Status:** [ ]

---

### Task 4.2: Create CDK configuration file

**Guidance:**
Create `infrastructure/cdk.json`:

```json
{
  "app": "npx ts-node --prefer-ts-exts bin/app.ts",
  "watch": {
    "include": ["**"],
    "exclude": [
      "README.md",
      "cdk*.json",
      "**/*.d.ts",
      "**/*.js",
      "tsconfig.json",
      "package*.json",
      "yarn.lock",
      "node_modules",
      "test"
    ]
  },
  "context": {
    "@aws-cdk/aws-lambda:recognizeLayerVersion": true,
    "@aws-cdk/core:checkSecretUsage": true,
    "@aws-cdk/core:target-partitions": ["aws", "aws-cn"],
    "@aws-cdk-containers/ecs-service-extensions:enableDefaultLogDriver": true,
    "@aws-cdk/aws-ec2:uniqueImdsv2TemplateName": true,
    "@aws-cdk/aws-ecs:arnFormatIncludesClusterName": true,
    "@aws-cdk/aws-iam:minimizePolicies": true,
    "@aws-cdk/core:validateSnapshotRemovalPolicy": true,
    "@aws-cdk/aws-codepipeline:crossAccountKeyAliasStackSafeResourceName": true,
    "@aws-cdk/aws-s3:createDefaultLoggingPolicy": true,
    "@aws-cdk/aws-sns-subscriptions:restrictSqsDescryption": true,
    "@aws-cdk/aws-apigateway:disableCloudWatchRole": true,
    "@aws-cdk/core:enablePartitionLiterals": true,
    "@aws-cdk/aws-events:eventsTargetQueueSameAccount": true,
    "@aws-cdk/aws-iam:standardizedServicePrincipals": true,
    "@aws-cdk/aws-ecs:disableExplicitDeploymentControllerForCircuitBreaker": true,
    "@aws-cdk/aws-iam:importedRoleStackSafeDefaultPolicyName": true,
    "@aws-cdk/aws-s3:serverAccessLogsUseBucketPolicy": true,
    "@aws-cdk/aws-route53-patters:useCertificate": true,
    "@aws-cdk/customresources:installLatestAwsSdkDefault": false,
    "@aws-cdk/aws-rds:databaseProxyUniqueResourceName": true,
    "@aws-cdk/aws-codedeploy:removeAlarmsFromDeploymentGroup": true,
    "@aws-cdk/aws-apigateway:authorizerChangeDeploymentLogicalId": true,
    "@aws-cdk/aws-ec2:launchTemplateDefaultUserData": true,
    "@aws-cdk/aws-secretsmanager:useAttachedSecretResourcePolicyForSecretTargetAttachments": true,
    "@aws-cdk/aws-redshift:columnId": true,
    "@aws-cdk/aws-stepfunctions-tasks:enableEmrServicePolicyV2": true,
    "@aws-cdk/aws-ec2:restrictDefaultSecurityGroup": true,
    "@aws-cdk/aws-apigateway:requestValidatorUniqueId": true,
    "@aws-cdk/aws-kms:aliasNameRef": true,
    "@aws-cdk/aws-autoscaling:generateLaunchTemplateInsteadOfLaunchConfig": true,
    "@aws-cdk/core:includePrefixInUniqueNameGeneration": true,
    "@aws-cdk/aws-efs:denyAnonymousAccess": true,
    "@aws-cdk/aws-opensearchservice:enableOpensearchMultiAzWithStandby": true,
    "@aws-cdk/aws-lambda-nodejs:useLatestRuntimeVersion": true,
    "@aws-cdk/aws-efs:mountTargetOrderInsensitiveLogicalId": true,
    "@aws-cdk/aws-rds:auroraClusterChangeScopeOfInstanceParameterGroupWithEachParameters": true,
    "@aws-cdk/aws-appsync:useArnForSourceApiAssociationIdentifier": true,
    "@aws-cdk/aws-rds:preventRenderingDeprecatedCredentials": true,
    "@aws-cdk/aws-codepipeline-actions:useNewDefaultBranchForCodeCommitSource": true,
    "@aws-cdk/aws-cloudwatch-actions:changeLambdaPermissionLogicalIdForLambdaAction": true,
    "@aws-cdk/aws-codepipeline:crossAccountKeysDefaultValueToFalse": true,
    "@aws-cdk/aws-codepipeline:defaultPipelineTypeToV2": true,
    "@aws-cdk/aws-kms:reduceCrossAccountRegionPolicyScope": true,
    "@aws-cdk/aws-eks:nodegroupNameAttribute": true,
    "@aws-cdk/aws-ec2:ebsDefaultGp3Volume": true,
    "@aws-cdk/aws-ecs:removeDefaultDeploymentAlarm": true,
    "@aws-cdk/custom-resources:logApiResponseDataPropertyTrueDefault": false,
    "@aws-cdk/aws-s3:keepNotificationInImportedBucket": false
  }
}
```

**Expected Output:**

- File `infrastructure/cdk.json` created
- CDK app entry point configured
- Feature flags set for CDK v2

**Status:** [ ]

---

### Task 4.3: Create CDK app entry point

**Guidance:**
Create `infrastructure/bin/app.ts`:

```typescript
#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { OpenNextStack } from "../lib/open-next-stack";

const app = new cdk.App();

new OpenNextStack(app, "OpenNextDemoStack", {
  env: {
    account: "708676091124",
    region: "ap-southeast-1",
  },
  description: "Next.js application deployed with OpenNext and CDK",
});
```

**Expected Output:**

- Directory `infrastructure/bin/` created
- File `infrastructure/bin/app.ts` created
- CDK app initialized with correct AWS account and region

**Status:** [ ]

---

### Task 4.4: Create main CDK stack file

**Guidance:**
Create `infrastructure/lib/open-next-stack.ts`:

```typescript
import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
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

    // TODO: Add infrastructure resources
    // This will be implemented in subsequent tasks
  }
}
```

**Expected Output:**

- Directory `infrastructure/lib/` created
- File `infrastructure/lib/open-next-stack.ts` created
- Basic stack structure with imports

**Status:** [ ]

---

### Task 4.5: Install ts-node for CDK

**Guidance:**

```bash
cd infrastructure
pnpm add -D ts-node source-map-support
```

**Expected Output:**

- `ts-node` and `source-map-support` added to devDependencies
- Required for running CDK TypeScript files

**Status:** [ ]

---

## Phase 5: Build OpenNext Output

### Task 5.1: Build Next.js application

**Guidance:**

```bash
cd /Users/dangthanhluan/works/open-next-demo
pnpm build
```

**Expected Output:**

- `.next/` directory created
- Build output shows all pages compiled
- No build errors
- Output shows: "✓ Compiled successfully"

**Status:** [ ]

---

### Task 5.2: Generate OpenNext build

**Guidance:**

```bash
pnpm open-next
```

**Expected Output:**

- `.open-next/` directory created with structure:
  - `.open-next/server-function/` - Server Lambda code
  - `.open-next/image-optimization-function/` - Image optimization Lambda
  - `.open-next/revalidation-function/` - Revalidation Lambda
  - `.open-next/assets/` - Static assets
  - `.open-next/cache/` - ISR cache files
- Success message displayed

**Status:** [ ]

---

### Task 5.3: Verify OpenNext output structure

**Guidance:**

```bash
ls -la .open-next/
```

**Expected Output:**

- Directories present:
  - `server-function/`
  - `image-optimization-function/`
  - `revalidation-function/`
  - `assets/`
  - `cache/`
- Each function directory contains `index.mjs` or similar entry point

**Status:** [ ]

---

## Phase 6: Implement CDK Infrastructure

### Task 6.1: Add S3 buckets to stack

**Guidance:**
Add to `infrastructure/lib/open-next-stack.ts`:

```typescript
// Assets bucket for static files
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

// Cache bucket for ISR
const cacheBucket = new s3.Bucket(this, "CacheBucket", {
  removalPolicy: cdk.RemovalPolicy.DESTROY,
  autoDeleteObjects: true,
});
```

**Expected Output:**

- S3 bucket resources defined in stack
- Buckets configured with appropriate policies

**Status:** [ ]

---

### Task 6.2: Add DynamoDB table to stack

**Guidance:**
Add to `infrastructure/lib/open-next-stack.ts`:

```typescript
// DynamoDB table for ISR cache
const cacheTable = new dynamodb.Table(this, "CacheTable", {
  partitionKey: { name: "path", type: dynamodb.AttributeType.STRING },
  sortKey: { name: "tag", type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  timeToLiveAttribute: "expireAt",
  removalPolicy: cdk.RemovalPolicy.DESTROY,
});
```

**Expected Output:**

- DynamoDB table resource defined
- Table configured with partition key, sort key, and TTL

**Status:** [ ]

---

### Task 6.3: Add Server Lambda function to stack

**Guidance:**
Add to `infrastructure/lib/open-next-stack.ts`:

```typescript
// Server Lambda function
const serverFunction = new lambda.Function(this, "ServerFunction", {
  runtime: lambda.Runtime.NODEJS_20_X,
  handler: "index.handler",
  code: lambda.Code.fromAsset(
    path.join(__dirname, "../../.open-next/server-function"),
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

// Create Function URL
const serverFunctionUrl = serverFunction.addFunctionUrl({
  authType: lambda.FunctionUrlAuthType.NONE,
});
```

**Expected Output:**

- Server Lambda function defined
- Function URL created
- Permissions granted for S3 and DynamoDB access

**Status:** [ ]

---

### Task 6.4: Add Image Optimization Lambda to stack

**Guidance:**
Add to `infrastructure/lib/open-next-stack.ts`:

```typescript
// Image Optimization Lambda
const imageOptFunction = new lambda.Function(this, "ImageOptFunction", {
  runtime: lambda.Runtime.NODEJS_20_X,
  handler: "index.handler",
  code: lambda.Code.fromAsset(
    path.join(__dirname, "../../.open-next/image-optimization-function"),
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
```

**Expected Output:**

- Image optimization Lambda defined
- Function URL created
- S3 read permissions granted

**Status:** [ ]

---

### Task 6.5: Add Revalidation Lambda to stack

**Guidance:**
Add to `infrastructure/lib/open-next-stack.ts`:

```typescript
// Revalidation Lambda
const revalidationFunction = new lambda.Function(this, "RevalidationFunction", {
  runtime: lambda.Runtime.NODEJS_20_X,
  handler: "index.handler",
  code: lambda.Code.fromAsset(
    path.join(__dirname, "../../.open-next/revalidation-function"),
  ),
  memorySize: 512,
  timeout: cdk.Duration.seconds(30),
  environment: {
    CACHE_DYNAMO_TABLE: cacheTable.tableName,
  },
});

// Grant permissions
cacheTable.grantReadWriteData(revalidationFunction);

// Create Function URL
const revalidationFunctionUrl = revalidationFunction.addFunctionUrl({
  authType: lambda.FunctionUrlAuthType.NONE,
});
```

**Expected Output:**

- Revalidation Lambda defined
- Function URL created
- DynamoDB permissions granted

**Status:** [ ]

---

### Task 6.6: Upload static assets to S3

**Guidance:**
Add to `infrastructure/lib/open-next-stack.ts`:

```typescript
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";

// Deploy static assets
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
```

**Expected Output:**

- S3 deployment resource defined
- Static assets will be uploaded during deployment

**Status:** [ ]

---

### Task 6.7: Create CloudFront distribution

**Guidance:**
Add to `infrastructure/lib/open-next-stack.ts`:

```typescript
// CloudFront distribution
const distribution = new cloudfront.Distribution(this, "Distribution", {
  defaultBehavior: {
    origin: new origins.HttpOrigin(
      cdk.Fn.select(2, cdk.Fn.split("/", serverFunctionUrl.url)),
    ),
    allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
    originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
  },
  additionalBehaviors: {
    "_next/static/*": {
      origin: new origins.S3Origin(assetsBucket),
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
    },
    "_next/image*": {
      origin: new origins.HttpOrigin(
        cdk.Fn.select(2, cdk.Fn.split("/", imageOptFunctionUrl.url)),
      ),
      allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
    },
  },
});
```

**Expected Output:**

- CloudFront distribution defined
- Multiple origins configured (server, assets, images)
- Cache behaviors set up

**Status:** [ ]

---

### Task 6.8: Add stack outputs

**Guidance:**
Add to end of `infrastructure/lib/open-next-stack.ts`:

```typescript
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
```

**Expected Output:**

- Stack outputs defined
- Will display important values after deployment

**Status:** [ ]

---

## Phase 7: Test and Deploy

### Task 7.1: Synthesize CDK stack

**Guidance:**

```bash
cd /Users/dangthanhluan/works/open-next-demo
pnpm cdk:synth
```

**Expected Output:**

- CloudFormation template generated in `infrastructure/cdk.out/`
- File `infrastructure/cdk.out/OpenNextDemoStack.template.json` created
- No synthesis errors
- Template shows all resources (S3, Lambda, CloudFront, DynamoDB)

**Status:** [ ]

---

### Task 7.2: Review CloudFormation template

**Guidance:**

```bash
cat infrastructure/cdk.out/OpenNextDemoStack.template.json | grep -A 5 "Resources"
```

**Expected Output:**

- Template contains resources:
  - S3 buckets (2)
  - Lambda functions (3)
  - DynamoDB table (1)
  - CloudFront distribution (1)
  - IAM roles and policies

**Status:** [ ]

---

### Task 7.3: Deploy to AWS

**Guidance:**

```bash
pnpm cdk:deploy
```

**Expected Output:**

- CDK deployment starts
- CloudFormation stack creation begins
- Progress updates shown for each resource
- Deployment completes successfully (5-15 minutes)
- Stack outputs displayed:
  - DistributionUrl
  - DistributionDomain
  - AssetsBucketName
  - CacheTableName

**Status:** [ ]

---

## Phase 8: Verification

### Task 8.1: Test SSG page

**Guidance:**

1. Get CloudFront URL from deployment outputs
2. Visit: `https://<cloudfront-url>/ssg`
3. Note the timestamp
4. Refresh multiple times

**Expected Output:**

- Page loads successfully
- Timestamp stays constant (generated at build time)
- Fast load time (< 1 second)

**Status:** [ ]

---

### Task 8.2: Test ISR page

**Guidance:**

1. Visit: `https://<cloudfront-url>/isr`
2. Note timestamp and random number
3. Refresh immediately - values stay same
4. Wait 65 seconds
5. Refresh - triggers regeneration
6. Refresh again - see new values

**Expected Output:**

- Page loads successfully
- Within 60s: cached values returned
- After 60s: regeneration triggered
- New values appear after regeneration

**Status:** [ ]

---

### Task 8.3: Test on-demand ISR

**Guidance:**

1. Visit: `https://<cloudfront-url>/isr-on-demand`
2. Note timestamp
3. Click "Trigger Revalidation" button
4. Page reloads with new timestamp

**Expected Output:**

- Revalidation button works
- API call succeeds
- Page regenerates immediately
- New timestamp displayed

**Status:** [ ]

---

### Task 8.4: Test SSR page

**Guidance:**

1. Visit: `https://<cloudfront-url>/ssr`
2. Note timestamp
3. Refresh multiple times rapidly

**Expected Output:**

- Each refresh shows new timestamp
- No caching occurs
- Response time < 2 seconds

**Status:** [ ]

---

### Task 8.5: Test streaming page

**Guidance:**

1. Visit: `https://<cloudfront-url>/streaming`
2. Open browser DevTools Network tab
3. Observe response loading

**Expected Output:**

- Content loads progressively
- Suspense boundaries work
- Streaming response visible in Network tab

**Status:** [ ]

---

### Task 8.6: Test edge runtime page

**Guidance:**

1. Visit: `https://<cloudfront-url>/edge`
2. Check response time
3. Verify edge runtime badge displayed

**Expected Output:**

- Page loads with low latency
- Edge runtime information displayed
- Response time < 500ms

**Status:** [ ]

---

### Task 8.7: Verify CloudWatch logs

**Guidance:**

1. Go to AWS Console → CloudWatch → Log Groups
2. Find log groups:
   - `/aws/lambda/OpenNextDemoStack-ServerFunction...`
   - `/aws/lambda/OpenNextDemoStack-ImageOptFunction...`
3. Check recent log streams

**Expected Output:**

- Log groups exist for each Lambda
- Recent invocations logged
- No error messages
- Request/response details visible

**Status:** [ ]

---

### Task 8.8: Verify DynamoDB cache

**Guidance:**

1. Go to AWS Console → DynamoDB → Tables
2. Find table (name from stack outputs)
3. Click "Explore table items"
4. Look for ISR cache entries

**Expected Output:**

- Table exists
- Contains cache entries for `/isr` route
- Entries have TTL values
- Cache keys match route paths

**Status:** [ ]

---

### Task 8.9: Test image optimization

**Guidance:**

1. Visit any page with images
2. Open DevTools Network tab
3. Check image requests
4. Verify format and size

**Expected Output:**

- Images served in WebP or AVIF format
- Images properly sized for viewport
- Image optimization Lambda invoked (check CloudWatch)

**Status:** [ ]

---

## Phase 9: Cleanup (Optional)

### Task 9.1: Destroy AWS resources

**Guidance:**

```bash
pnpm cdk:destroy
```

**Expected Output:**

- Confirmation prompt appears
- Type 'y' to confirm
- CloudFormation stack deletion begins
- All resources removed:
  - CloudFront distribution disabled and deleted
  - Lambda functions deleted
  - S3 buckets emptied and deleted
  - DynamoDB table deleted
- Success message: "OpenNextDemoStack: destroyed"

**Status:** [ ]

---

## Summary

**Total Tasks:** 44
**Estimated Time:** 2-3 hours (including deployment wait times)

**Key Milestones:**

- ✅ Prerequisites setup (Tasks 1.1-1.2)
- ✅ Project configuration (Tasks 2.1-3.3)
- ✅ CDK infrastructure code (Tasks 4.1-6.8)
- ✅ Deployment (Tasks 7.1-7.3)
- ✅ Verification (Tasks 8.1-8.9)

# Deployment Guide

This guide will walk you through deploying your Next.js application to AWS using CDK and OpenNext.

## Prerequisites

Before deploying, ensure you have:

### 1. AWS Account Setup

- An active AWS account
- AWS CLI installed and configured
- Appropriate IAM permissions for creating resources (S3, Lambda, CloudFront, DynamoDB, IAM)

### 2. Install AWS CLI

**Windows:**

```bash
# Download and install from: https://aws.amazon.com/cli/
# Or using winget:
winget install Amazon.AWSCLI
```

**macOS:**

```bash
brew install awscli
```

**Linux:**

```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

### 3. Configure AWS Credentials

```bash
aws configure
```

You'll be prompted for:

- AWS Access Key ID
- AWS Secret Access Key
- Default region (e.g., `us-east-1`)
- Default output format (e.g., `json`)

### 4. Install AWS CDK CLI

```bash
npm install -g aws-cdk
```

Verify installation:

```bash
cdk --version
```

### 5. Install Project Dependencies

```bash
pnpm install
```

## Deployment Steps

### Step 1: Bootstrap CDK (First Time Only)

Bootstrap CDK in your AWS account and region:

```bash
cdk bootstrap aws://ACCOUNT-ID/REGION
```

Replace:

- `ACCOUNT-ID` with your AWS account ID (12-digit number)
- `REGION` with your preferred AWS region (e.g., `us-east-1`)

Example:

```bash
cdk bootstrap aws://123456789012/us-east-1
```

> **Note:** You only need to bootstrap once per account/region combination.

### Step 2: Build Your Application

Build the Next.js application with OpenNext:

```bash
pnpm open-next
```

This creates the `.open-next` directory with all the necessary Lambda functions and assets.

### Step 3: Preview Changes (Optional)

Review what CDK will deploy:

```bash
pnpm cdk:synth
```

This generates the CloudFormation template. You can also see what changes will be made:

```bash
cdk diff
```

### Step 4: Deploy to AWS

Deploy everything with a single command:

```bash
pnpm deploy
```

Or deploy manually in two steps:

```bash
# 1. Build with OpenNext
pnpm open-next

# 2. Deploy with CDK
pnpm cdk:deploy
```

The deployment will:

1. Create S3 buckets for assets and cache
2. Create DynamoDB table for ISR cache
3. Create Lambda functions (server, image optimization, revalidation, warmer)
4. Create CloudFront distribution
5. Upload static assets to S3
6. Configure all permissions and policies

**Deployment time:** ~5-10 minutes

### Step 5: Access Your Application

After deployment completes, you'll see outputs including:

```
Outputs:
OpenNextDemoStack.DistributionUrl = https://d1234567890abc.cloudfront.net
OpenNextDemoStack.DistributionDomain = d1234567890abc.cloudfront.net
OpenNextDemoStack.AssetsBucketName = opennextdemostack-assetsbucket-xxxxx
OpenNextDemoStack.CacheTableName = opennextdemostack-cachetable-xxxxx
```

Visit the `DistributionUrl` to see your deployed application!

## Testing Your Deployment

### Test All Rendering Strategies

1. **SSG**: Visit `https://your-cloudfront-url/ssg`
   - Should show static content generated at build time

2. **ISR**: Visit `https://your-cloudfront-url/isr`
   - Refresh multiple times within 60 seconds - timestamp stays the same
   - Wait 60+ seconds and refresh - triggers regeneration

3. **On-Demand ISR**: Visit `https://your-cloudfront-url/isr-on-demand`
   - Click "Trigger Revalidation" button
   - Page should reload with new timestamp

4. **SSR**: Visit `https://your-cloudfront-url/ssr`
   - Refresh multiple times - timestamp updates on every request

5. **Streaming**: Visit `https://your-cloudfront-url/streaming`
   - Content should load progressively

6. **Edge Runtime**: Visit `https://your-cloudfront-url/edge`
   - Should respond with ultra-low latency

### Monitor Your Application

**CloudWatch Logs:**

```bash
# View server function logs
aws logs tail /aws/lambda/OpenNextDemoStack-ServerFunction --follow

# View image optimization logs
aws logs tail /aws/lambda/OpenNextDemoStack-ImageOptFunction --follow
```

**CloudFront Metrics:**

- Go to AWS Console → CloudFront → Your Distribution → Monitoring

**DynamoDB Cache:**

- Go to AWS Console → DynamoDB → Tables → Your Cache Table
- View items to see ISR cache entries

## Updating Your Application

When you make changes to your application:

```bash
# 1. Rebuild with OpenNext
pnpm open-next

# 2. Redeploy
pnpm cdk:deploy
```

CDK will only update the resources that changed.

## Custom Domain (Optional)

To use a custom domain:

1. **Get an SSL certificate** in AWS Certificate Manager (must be in `us-east-1` for CloudFront)
2. **Update the stack** to include the certificate and domain
3. **Create DNS records** pointing to your CloudFront distribution

## Cleanup / Destroy Resources

To remove all AWS resources:

```bash
pnpm cdk:destroy
```

> **Warning:** This will delete all resources including S3 buckets and DynamoDB tables. Make sure you have backups if needed.

## Cost Considerations

Estimated monthly costs (low traffic):

- **CloudFront**: ~$1-5 (first 1TB free tier)
- **Lambda**: ~$0-5 (1M requests free tier)
- **S3**: ~$0.50-2
- **DynamoDB**: ~$0-2.50 (25GB free tier)

**Total**: ~$2-15/month for low-medium traffic

For production with higher traffic, costs will scale based on:

- CloudFront data transfer
- Lambda invocations and duration
- S3 storage and requests
- DynamoDB read/write capacity

## Troubleshooting

### CDK Bootstrap Error

```
Error: This stack uses assets, so the toolkit stack must be deployed to the environment
```

**Solution:** Run `cdk bootstrap` as described in Step 1

### Permission Denied

```
Error: User is not authorized to perform: cloudformation:CreateStack
```

**Solution:** Ensure your AWS user has appropriate IAM permissions

### Lambda Function Not Found

```
Error: Cannot find asset at path: .open-next/server-functions/default
```

**Solution:** Run `pnpm open-next` before deploying

### CloudFront 403 Error

**Solution:**

- Check S3 bucket permissions
- Verify Lambda function URLs are accessible
- Check CloudFront origin settings

### ISR Not Working

**Solution:**

- Verify DynamoDB table exists and has correct permissions
- Check Lambda environment variables
- Review CloudWatch logs for errors

## Additional Resources

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [OpenNext Documentation](https://opennext.js.org/)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [CloudFront Documentation](https://docs.aws.amazon.com/cloudfront/)

## Support

For issues:

- Check CloudWatch logs for Lambda errors
- Review CloudFormation events in AWS Console
- Verify all prerequisites are met

# ISR On-Demand Fix - Deployment Checklist

Use this checklist to track your deployment progress.

## Pre-Deployment Checklist

- [ ] Read `README_ISR_FIX.md` for overview
- [ ] Review `FIX_SUMMARY.md` for changes made
- [ ] Ensure AWS credentials are configured
- [ ] Ensure you have CDK installed (`npm install -g aws-cdk`)

## Deployment Steps

### 1. Build Next.js Application

```bash
npm run build
```

- [ ] Build completed successfully
- [ ] No build errors

### 2. Build OpenNext

```bash
npm run open-next
```

- [ ] OpenNext build completed
- [ ] `.open-next` directory created
- [ ] Check that `.open-next/revalidation-function` exists

### 3. Verify Lambda Dependencies

```bash
ls infrastructure/lambda/cloudfront-invalidation/node_modules
```

- [ ] `node_modules` directory exists
- [ ] `@aws-sdk/client-cloudfront` is installed

### 4. Deploy Infrastructure

```bash
npm run cdk:deploy
# or
cd infrastructure && cdk deploy
```

- [ ] CDK deployment started
- [ ] CloudFormation stack update in progress
- [ ] No deployment errors
- [ ] Deployment completed successfully

### 5. Note Stack Outputs

After deployment, save these values:

```bash
# Get outputs
aws cloudformation describe-stacks --stack-name OpenNextDemoStack \
  --query "Stacks[0].Outputs" --output table
```

- [ ] `DistributionUrl`: ****************\_\_\_****************
- [ ] `DistributionId`: ****************\_\_\_****************
- [ ] `CacheTableName`: ****************\_\_\_****************
- [ ] `RevalidationQueueUrl`: ****************\_\_\_****************

## Testing Checklist

### 1. Initial Page Load

- [ ] Visit `https://<DistributionUrl>/isr-on-demand`
- [ ] Page loads successfully
- [ ] Timestamp is displayed
- [ ] Note timestamp: ****************\_\_\_****************

### 2. Trigger Revalidation

- [ ] Click "Trigger Revalidation" button
- [ ] Success message appears
- [ ] No error messages

### 3. Verify Backend Processing

#### Check SQS Queue

```bash
aws sqs get-queue-attributes \
  --queue-url <RevalidationQueueUrl> \
  --attribute-names ApproximateNumberOfMessages
```

- [ ] Command executed successfully
- [ ] Messages were processed (count should be 0 or low)

#### Check Lambda Logs

```bash
# Revalidation function
aws logs tail /aws/lambda/OpenNextDemoStack-RevalidationFunction --since 5m

# CloudFront invalidation function
aws logs tail /aws/lambda/OpenNextDemoStack-CloudFrontInvalidationFunction --since 5m
```

- [ ] Revalidation function logs show processing
- [ ] CloudFront invalidation function logs show invalidation created
- [ ] No errors in logs

#### Check CloudFront Invalidations

```bash
aws cloudfront list-invalidations --distribution-id <DistributionId> --max-items 5
```

- [ ] Invalidation was created
- [ ] Invalidation status: `InProgress` or `Completed`
- [ ] Invalidation ID: ****************\_\_\_****************

### 4. Verify Page Update

- [ ] Wait 30 seconds for CloudFront invalidation to propagate
- [ ] Refresh the page (or open in new incognito window)
- [ ] New timestamp is displayed
- [ ] New timestamp: ****************\_\_\_****************
- [ ] ✅ **Timestamp changed! Fix is working!**

## Troubleshooting (if needed)

If timestamp doesn't change:

- [ ] Waited at least 30 seconds
- [ ] Tried in incognito/private window
- [ ] Checked CloudWatch Logs for errors
- [ ] Verified CloudFront invalidation was created
- [ ] Checked SQS queue for stuck messages

See `DEPLOYMENT_GUIDE.md` for detailed troubleshooting.

## Post-Deployment

### Monitoring Setup (Optional)

- [ ] Set up CloudWatch alarm for Lambda errors
- [ ] Set up CloudWatch alarm for SQS dead letter queue
- [ ] Set up CloudWatch dashboard for ISR metrics

### Documentation

- [ ] Team notified of new deployment
- [ ] Documentation updated with CloudFront URL
- [ ] Monitoring runbook updated

## Rollback Plan (if needed)

If you need to rollback:

```bash
cd infrastructure
cdk destroy
# Then redeploy previous version
```

- [ ] Rollback plan understood
- [ ] Previous version backed up

## Success Criteria

✅ All items checked means successful deployment!

- [ ] Infrastructure deployed without errors
- [ ] Page loads successfully
- [ ] Revalidation triggers successfully
- [ ] CloudFront invalidation is created
- [ ] Timestamp changes after revalidation
- [ ] No errors in CloudWatch Logs

---

**Deployment Date**: ********\_\_\_********  
**Deployed By**: ********\_\_\_********  
**CloudFront Distribution**: ********\_\_\_********  
**Status**: ⬜ In Progress | ⬜ Completed | ⬜ Failed

---

## Notes

Use this space for any deployment notes or issues encountered:

---

---

---

---

#!/usr/bin/env node
/**
 * CloudFront Invalidation Wrapper for OpenNext Revalidation Function
 *
 * This script wraps the OpenNext revalidation function to add CloudFront
 * invalidation support. It intercepts revalidation requests and creates
 * CloudFront invalidations for the revalidated paths.
 */

const {
  CloudFrontClient,
  CreateInvalidationCommand,
} = require("@aws-sdk/client-cloudfront");

const cloudfront = new CloudFrontClient({ region: process.env.AWS_REGION });

// Import the original OpenNext revalidation handler
const { handler: originalHandler } = require("./index.mjs");

/**
 * Extract paths from revalidation records
 */
function extractPaths(records) {
  const paths = new Set();

  for (const record of records) {
    if (record.url) {
      // Add the URL path
      paths.add(record.url);

      // Also add the .rsc data route if it's a page
      if (!record.url.includes("._rsc")) {
        paths.add(`${record.url}.rsc`);
      }
    }
  }

  return Array.from(paths);
}

/**
 * Create CloudFront invalidation
 */
async function invalidateCloudFront(paths) {
  const distributionId = process.env.CLOUDFRONT_DISTRIBUTION_ID;

  if (!distributionId) {
    console.warn(
      "[CloudFront Invalidation] CLOUDFRONT_DISTRIBUTION_ID not set, skipping invalidation",
    );
    return;
  }

  if (paths.length === 0) {
    console.log("[CloudFront Invalidation] No paths to invalidate");
    return;
  }

  try {
    console.log(
      `[CloudFront Invalidation] Creating invalidation for ${paths.length} paths:`,
      paths,
    );

    const command = new CreateInvalidationCommand({
      DistributionId: distributionId,
      InvalidationBatch: {
        CallerReference: `revalidation-${Date.now()}`,
        Paths: {
          Quantity: paths.length,
          Items: paths,
        },
      },
    });

    const response = await cloudfront.send(command);

    console.log(
      `[CloudFront Invalidation] Created invalidation ${response.Invalidation.Id}`,
      {
        status: response.Invalidation.Status,
        createTime: response.Invalidation.CreateTime,
      },
    );
  } catch (error) {
    console.error("[CloudFront Invalidation] Failed to create invalidation:", {
      error: error.message,
      code: error.Code,
      distributionId,
      paths,
    });
    // Don't throw - we don't want to fail the revalidation if CloudFront invalidation fails
  }
}

/**
 * Wrapped handler that adds CloudFront invalidation
 */
exports.handler = async (event, context) => {
  console.log("[Revalidation Wrapper] Processing event:", {
    records: event.Records?.length || 0,
  });

  // Extract paths before processing
  const paths = event.Records
    ? extractPaths(event.Records.map((r) => JSON.parse(r.body)))
    : [];

  // Call the original OpenNext handler
  const result = await originalHandler(event, context);

  // After successful revalidation, invalidate CloudFront cache
  if (paths.length > 0) {
    await invalidateCloudFront(paths);
  }

  return result;
};

const {
  CloudFrontClient,
  CreateInvalidationCommand,
} = require("@aws-sdk/client-cloudfront");

const cloudfront = new CloudFrontClient({});

exports.handler = async (event) => {
  console.log("[CloudFront Invalidation] Processing event:", {
    recordCount: event.Records?.length || 0,
  });

  const distributionId = process.env.CLOUDFRONT_DISTRIBUTION_ID;

  if (!distributionId) {
    console.error(
      "[CloudFront Invalidation] ERROR: CLOUDFRONT_DISTRIBUTION_ID not set",
    );
    return {
      batchItemFailures: [],
    };
  }

  // Extract paths from SQS messages
  const paths = new Set();
  const failedRecords = [];

  for (const record of event.Records || []) {
    try {
      const body = JSON.parse(record.body);
      const { url } = body;

      if (url) {
        console.log(
          `[CloudFront Invalidation] Found path to invalidate: ${url}`,
        );

        // Add the main path
        paths.add(url);

        // Add the RSC data route for Next.js pages
        if (!url.endsWith(".rsc")) {
          paths.add(`${url}.rsc`);
        }

        // Add the _next/data route for client-side navigation
        // Format: /_next/data/{buildId}/{path}.json
        if (!url.startsWith("/_next/data/")) {
          const pathWithoutLeadingSlash = url.startsWith("/")
            ? url.slice(1)
            : url;
          paths.add(`/_next/data/*/${pathWithoutLeadingSlash}.json`);
        }
      }
    } catch (error) {
      console.error(
        `[CloudFront Invalidation] Failed to parse record:`,
        error.message,
      );
      failedRecords.push({
        itemIdentifier: record.messageId,
      });
    }
  }

  const pathsArray = Array.from(paths);

  if (pathsArray.length === 0) {
    console.log("[CloudFront Invalidation] No paths to invalidate");
    return {
      batchItemFailures: failedRecords,
    };
  }

  // Create CloudFront invalidation
  try {
    console.log(
      `[CloudFront Invalidation] Creating invalidation for ${pathsArray.length} paths:`,
      pathsArray,
    );

    const command = new CreateInvalidationCommand({
      DistributionId: distributionId,
      InvalidationBatch: {
        CallerReference: `isr-revalidation-${Date.now()}-${Math.random()
          .toString(36)
          .substring(7)}`,
        Paths: {
          Quantity: pathsArray.length,
          Items: pathsArray,
        },
      },
    });

    const response = await cloudfront.send(command);

    console.log(
      `[CloudFront Invalidation] ✅ Successfully created invalidation:`,
      {
        invalidationId: response.Invalidation.Id,
        status: response.Invalidation.Status,
        createTime: response.Invalidation.CreateTime,
        paths: pathsArray,
      },
    );

    return {
      batchItemFailures: failedRecords,
    };
  } catch (error) {
    console.error(
      "[CloudFront Invalidation] ❌ Failed to create invalidation:",
      {
        error: error.message,
        code: error.Code || error.name,
        distributionId,
        paths: pathsArray,
        stack: error.stack,
      },
    );

    // Return all records as failed so they can be retried
    return {
      batchItemFailures: event.Records.map((r) => ({
        itemIdentifier: r.messageId,
      })),
    };
  }
};

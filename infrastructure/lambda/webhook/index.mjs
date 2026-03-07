import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { S3Client, ListObjectsV2Command, DeleteObjectCommand } from "@aws-sdk/client-s3";

const sqsClient = new SQSClient({});
const s3Client = new S3Client({});

export const handler = async (event) => {
  console.log("Webhook triggered. Event:", JSON.stringify(event));

  try {
    let body;
    if (event.body) {
        body = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf-8') : event.body;
        body = JSON.parse(body);
    } else {
        return { statusCode: 400, body: JSON.stringify({ error: "Missing body" }) };
    }

    const path = body.path;
    if (!path) {
        return { statusCode: 400, body: JSON.stringify({ error: "Missing path field" }) };
    }

    console.log(`Received request to invalidate path: ${path}`);
    
    // We manually delete the object from the OpenNext Cache bucket because revalidatePath
    // sometimes fails to clear S3 when using squashed cache adapters.
    const cacheBucket = process.env.CACHE_BUCKET_NAME;
    if (cacheBucket) {
      try {
        console.log(`Looking for stale cache files for path: ${path} in bucket: ${cacheBucket}`);
        const s3Path = path.startsWith('/') ? path.substring(1) : path;
        
        const data = await s3Client.send(new ListObjectsV2Command({ Bucket: cacheBucket }));
        if (data.Contents) {
          for (const item of data.Contents) {
            // Delete cache, HTML, and JSON representations
            if (item.Key.endsWith(`${s3Path}.cache`) || 
                item.Key.endsWith(`${s3Path}.html`) || 
                item.Key.endsWith(`${s3Path}.rsc`) || 
                item.Key.endsWith(`${s3Path}.json`)) {
              console.log(`Deleting stale cache file: ${item.Key}`);
              await s3Client.send(new DeleteObjectCommand({ Bucket: cacheBucket, Key: item.Key }));
            }
          }
        }
      } catch (err) {
        console.error(`S3 Cache deletion error: ${err.message}`);
      }
    }

    // Now trigger CloudFront invalidation so the Edge pulls the newly generated Server-side fetch!
    if (process.env.INVALIDATION_QUEUE_URL) {
      const invalidationCommand = new SendMessageCommand({
        QueueUrl: process.env.INVALIDATION_QUEUE_URL,
        MessageBody: JSON.stringify({
          url: path
        }),
      });
      await sqsClient.send(invalidationCommand);
      console.log(`Successfully sent CloudFront invalidation message for ${path}`);
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, message: `Invalidation triggered for ${path}` }),
    };
  } catch (error) {
    console.error("Error processing webhook:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }
};

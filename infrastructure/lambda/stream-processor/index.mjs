import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const sqsClient = new SQSClient({
  region: process.env.AWS_REGION || "ap-southeast-1",
});

export const handler = async (event) => {
  console.log("DynamoDB Stream Event:", JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    if (record.eventName === "MODIFY" || record.eventName === "INSERT") {
      const newImage = record.dynamodb.NewImage;
      const oldImage = record.dynamodb.OldImage;

      const newRevalidatedAt = newImage?.revalidatedAt?.N;
      const oldRevalidatedAt = oldImage?.revalidatedAt?.N;

      // If revalidatedAt hasn't changed, ignore to avoid infinite loops from other updates
      if (
        record.eventName === "MODIFY" &&
        newRevalidatedAt === oldRevalidatedAt
      ) {
        console.log("revalidatedAt not changed, skipping.");
        continue;
      }

      const pathValue = newImage?.path?.S;
      if (!pathValue) {
        console.log("No path value found, skipping.");
        continue;
      }

      console.log(`Processing path: ${pathValue}`);

      const payload = {
        host: "unknown", // host is not stored in DynamoDB, open-next fallback
        url: pathValue,
      };

      const messageBody = JSON.stringify(payload);
      const promises = [];

      if (process.env.REVALIDATION_QUEUE_URL) {
        promises.push(
          sqsClient.send(
            new SendMessageCommand({
              QueueUrl: process.env.REVALIDATION_QUEUE_URL,
              MessageBody: messageBody,
            }),
          ),
        );
      } else {
        console.warn("REVALIDATION_QUEUE_URL is not set.");
      }

      if (process.env.INVALIDATION_QUEUE_URL) {
        promises.push(
          sqsClient.send(
            new SendMessageCommand({
              QueueUrl: process.env.INVALIDATION_QUEUE_URL,
              MessageBody: messageBody,
            }),
          ),
        );
      } else {
        console.warn("INVALIDATION_QUEUE_URL is not set.");
      }

      const results = await Promise.allSettled(promises);
      for (const res of results) {
        if (res.status === "rejected") {
          console.error("Failed to send SQS message:", res.reason);
        } else {
          console.log("Successfully sent message to SQS.");
        }
      }
    }
  }
};

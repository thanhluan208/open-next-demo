import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  console.log(
    `[${timestamp}] ========== REVALIDATION REQUEST START ==========`,
  );

  try {
    const body = await request.json();
    const { path, type = "page" } = body;

    console.log(`[${timestamp}] Request body:`, JSON.stringify({ path, type }));
    console.log(`[${timestamp}] Environment:`, {
      CACHE_BUCKET_NAME: process.env.CACHE_BUCKET_NAME,
      CACHE_DYNAMO_TABLE: process.env.CACHE_DYNAMO_TABLE,
      REVALIDATION_QUEUE_URL: process.env.REVALIDATION_QUEUE_URL,
      REVALIDATION_QUEUE_REGION: process.env.REVALIDATION_QUEUE_REGION,
      NODE_ENV: process.env.NODE_ENV,
    });

    if (!path) {
      console.error(`[${timestamp}] ERROR: Missing path parameter`);
      return NextResponse.json({ error: "Path is required" }, { status: 400 });
    }

    console.log(`[${timestamp}] Calling revalidatePath("${path}", "${type}")`);

    // Revalidate the specified path
    revalidatePath(path, type);

    console.log(`[${timestamp}] revalidatePath completed successfully`);

    // WORKAROUND: Manually send SQS message for Next.js 16 + OpenNext compatibility
    // In Next.js 16, revalidatePath() doesn't automatically send SQS messages
    const queueUrl = process.env.REVALIDATION_QUEUE_URL;
    const queueRegion =
      process.env.REVALIDATION_QUEUE_REGION || "ap-southeast-1";

    if (queueUrl) {
      console.log(
        `[${timestamp}] Manually sending SQS message to queue: ${queueUrl}`,
      );

      try {
        const sqsClient = new SQSClient({ region: queueRegion });
        const host = request.headers.get("host") || "unknown";

        const messageBody = JSON.stringify({
          host,
          url: path,
        });

        const command = new SendMessageCommand({
          QueueUrl: queueUrl,
          MessageBody: messageBody,
        });

        const result = await sqsClient.send(command);
        console.log(`[${timestamp}] ✅ SQS message sent successfully:`, {
          messageId: result.MessageId,
          host,
          path,
        });
      } catch (sqsError) {
        console.error(
          `[${timestamp}] ❌ Failed to send SQS message:`,
          sqsError,
        );
        // Don't fail the request if SQS fails, just log it
      }
    } else {
      console.warn(
        `[${timestamp}] ⚠️  REVALIDATION_QUEUE_URL not set, skipping SQS message`,
      );
    }
    console.log(
      `[${timestamp}] ========== REVALIDATION REQUEST END ==========`,
    );

    return NextResponse.json(
      {
        revalidated: true,
        path,
        type,
        now: Date.now(),
        timestamp,
      },
      {
        headers: {
          "Cache-Control": "no-store, must-revalidate",
          "CDN-Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error(`[${timestamp}] REVALIDATION ERROR:`, error);
    console.error(
      `[${timestamp}] Error stack:`,
      error instanceof Error ? error.stack : "No stack",
    );
    return NextResponse.json(
      {
        error: "Failed to revalidate",
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp,
      },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";

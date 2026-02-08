import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

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

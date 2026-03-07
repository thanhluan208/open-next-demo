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

    if (!path) {
      console.error(`[${timestamp}] ERROR: Missing path parameter`);
      return NextResponse.json({ error: "Path is required" }, { status: 400 });
    }

    console.log(`[${timestamp}] Calling revalidatePath("${path}", "${type}")`);

    // Revalidate the specified path
    revalidatePath(path, type);

    console.log(`[${timestamp}] revalidatePath completed successfully`);

    if (process.env.WEBHOOK_URL) {
      console.log(
        `[${timestamp}] Triggering AWS Webhook to invalidate CloudFront cache...`,
      );
      // Await webhook call so lambda execution doesn't freeze before it sends
      await fetch(process.env.WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ path }),
      }).catch((err) => console.error("Webhook trigger failed:", err));
      console.log(
        `[${timestamp}] Webhook triggered at ${process.env.WEBHOOK_URL}`,
      );
    } else {
      console.log(
        `[${timestamp}] WARNING: WEBHOOK_URL not configured. CDN will not be invalidated.`,
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

import { revalidatePath } from "next/cache";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { path } = body;

    if (!path) {
      return Response.json({ error: "Path is required" }, { status: 400 });
    }

    // Revalidate the specified path
    revalidatePath(path);

    return Response.json({
      revalidated: true,
      path,
      now: Date.now(),
    });
  } catch (error) {
    return Response.json(
      {
        error: "Failed to revalidate",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

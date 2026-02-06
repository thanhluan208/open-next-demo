// Edge runtime API route
export const runtime = "edge";

export async function GET(request: Request) {
  const timestamp = new Date().toISOString();

  // Access request headers
  const userAgent = request.headers.get("user-agent") || "Unknown";

  // In production on Vercel, you can access geo data
  const geo = {
    region: process.env.VERCEL_REGION || "local",
    // In production: request.geo?.city, request.geo?.country, etc.
  };

  return Response.json(
    {
      message: "Hello from the Edge!",
      timestamp,
      runtime: "edge",
      geo,
      userAgent: userAgent.substring(0, 50) + "...", // Truncate for display
    },
    {
      headers: {
        "content-type": "application/json",
        "x-edge-runtime": "true",
      },
    },
  );
}

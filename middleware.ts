import { NextRequest, NextResponse } from "next/server";

/**
 * MIDDLEWARE — Latency Benchmark Demo
 *
 * Purpose: Make middleware latency clearly visible and measurable,
 * so you can compare:
 *   A) Current setup  → middleware runs in ap-southeast-1 (Singapore Lambda)
 *   B) Edge runtime   → middleware runs at nearest CloudFront PoP
 *
 * What this middleware does (realistic real-world simulation):
 *  1. Reads auth token from cookie/header
 *  2. Simulates token validation (string ops, no external calls)
 *  3. Reads geo/country headers (set by CloudFront)
 *  4. Stamps response headers with timing info so you can measure it
 *
 * Headers added to every response:
 *  x-middleware-start     → when middleware started (Unix ms)
 *  x-middleware-duration  → how long middleware itself took (ms)
 *  x-middleware-region    → which AWS region/runtime processed this
 *  x-middleware-auth      → whether auth passed or was skipped
 *  x-middleware-country   → detected country from CloudFront headers
 *  x-middleware-ran       → always "true" — confirms middleware ran
 */

// Routes that require authentication
const PROTECTED_ROUTES = ["/ssr", "/streaming", "/isr-on-demand"];

// Routes to skip middleware entirely (static files, APIs already handled)
const SKIP_ROUTES = ["/_next", "/favicon.ico", "/api"];

export function middleware(request: NextRequest) {
  const start = Date.now();

  const { pathname } = request.nextUrl;

  // Skip static assets and internal Next.js routes
  if (SKIP_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // ── Step 1: Read auth token (cookie or Authorization header) ──────────────
  const authToken =
    request.cookies.get("auth-token")?.value ||
    request.headers.get("authorization")?.replace("Bearer ", "") ||
    null;

  // ── Step 2: Simulate token validation (CPU work, no I/O) ─────────────────
  // This mimics what real auth middleware does — parse + validate a JWT-like token
  let authStatus = "no-token";
  let userId: string | null = null;

  if (authToken) {
    // Simulate parsing a base64-encoded token (like a JWT payload)
    try {
      // Fake token format: base64("userId:role:expiry")
      const decoded = atob(authToken);
      const [id, , expiryStr] = decoded.split(":");
      const expiry = parseInt(expiryStr || "0", 10);

      if (expiry > Date.now()) {
        authStatus = "valid";
        userId = id;
      } else {
        authStatus = "expired";
      }
    } catch {
      authStatus = "invalid";
    }
  }

  // ── Step 3: Check if protected route requires auth ────────────────────────
  const isProtected = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route),
  );

  if (isProtected && authStatus !== "valid") {
    // In a real app: redirect to /login
    // For demo: we let it through but mark it as unauthenticated
    authStatus = authStatus === "no-token" ? "public-access" : authStatus;
  }

  // ── Step 4: Read CloudFront geo headers (set automatically by CloudFront) ─
  // These are only available in production on AWS, not locally
  const country =
    request.headers.get("cloudfront-viewer-country") ||
    request.headers.get("cf-ipcountry") ||
    "unknown";

  const city = request.headers.get("cloudfront-viewer-city") || "unknown";

  const viewerLatitude =
    request.headers.get("cloudfront-viewer-latitude") || null;

  // ── Step 5: Simulate a small amount of business logic ────────────────────
  // e.g., feature flag lookup, A/B test bucket assignment
  // This uses CPU without any async I/O (edge-compatible)
  const abBucket =
    simpleHash(
      (userId || request.headers.get("x-forwarded-for") || "anonymous") +
        pathname,
    ) %
      2 ===
    0
      ? "control"
      : "treatment";

  // ── Step 6: Read headers set by Lambda@Edge (if deployed) ────────────────
  // Lambda@Edge viewer request runs BEFORE this ServerFunction in Singapore.
  // It sets x-edge-* headers on the REQUEST. We echo them as RESPONSE headers
  // so they're visible in curl/DevTools — proving Lambda@Edge ran at the edge.
  const edgeRan = request.headers.get("x-edge-middleware-ran");
  const edgeDuration = request.headers.get("x-edge-middleware-duration");
  const edgePop = request.headers.get("x-edge-middleware-pop");
  const edgeCountry = request.headers.get("x-edge-middleware-country");
  const edgeCity = request.headers.get("x-edge-middleware-city");
  const edgeAuth = request.headers.get("x-edge-middleware-auth");
  const edgeAb = request.headers.get("x-edge-middleware-ab");

  // ── Step 7: Build response with diagnostic headers ────────────────────────
  const response = NextResponse.next();

  const duration = Date.now() - start;

  // These headers are the KEY metrics for your test:
  // Look at x-middleware-duration in DevTools or curl to see how long it took
  response.headers.set("x-middleware-ran", "true");
  response.headers.set("x-middleware-start", String(start));
  response.headers.set("x-middleware-duration", `${duration}ms`);
  response.headers.set(
    "x-middleware-region",
    process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "local",
  );
  response.headers.set("x-middleware-auth", authStatus);
  response.headers.set("x-middleware-country", country);
  response.headers.set("x-middleware-city", city);
  response.headers.set("x-middleware-ab-bucket", abBucket);

  if (viewerLatitude) {
    response.headers.set("x-middleware-viewer-lat", viewerLatitude);
  }

  if (userId) {
    response.headers.set("x-middleware-user", userId.substring(0, 8));
  }

  // ── Echo Lambda@Edge headers as response headers (if Lambda@Edge is deployed) ─
  // These prove Lambda@Edge ran at the nearest PoP BEFORE the request reached Singapore.
  // x-edge-*  = set by Lambda@Edge at nearest CloudFront PoP (e.g. Frankfurt for Amsterdam)
  // x-middleware-* = set by this ServerFunction in ap-southeast-1 (Singapore)
  if (edgeRan) {
    response.headers.set("x-edge-middleware-ran", edgeRan);
    if (edgeDuration)
      response.headers.set("x-edge-middleware-duration", edgeDuration);
    if (edgePop) response.headers.set("x-edge-middleware-pop", edgePop);
    if (edgeCountry)
      response.headers.set("x-edge-middleware-country", edgeCountry);
    if (edgeCity) response.headers.set("x-edge-middleware-city", edgeCity);
    if (edgeAuth) response.headers.set("x-edge-middleware-auth", edgeAuth);
    if (edgeAb) response.headers.set("x-edge-middleware-ab", edgeAb);
  }

  return response;
}

/**
 * Simple non-cryptographic hash for A/B bucketing.
 * Uses only string operations — fully edge-compatible.
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

export const config = {
  // Run on all routes except Next.js internals and static files
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

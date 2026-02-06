import DemoCard from "@/components/DemoCard";
import CodeBlock from "@/components/CodeBlock";
import Link from "next/link";

// Configure edge runtime
export const runtime = "edge";

export default async function EdgePage() {
  const requestTime = new Date().toISOString();

  // Edge runtime has access to limited APIs
  const edgeInfo = {
    runtime: "edge",
    timestamp: requestTime,
    // In production, you could access geo-location data
    region: process.env.VERCEL_REGION || "local",
  };

  const configCode = `// Enable Edge Runtime
export const runtime = 'edge';

export default async function EdgePage() {
  // This runs on edge servers globally
  const data = await fetchData();
  return <div>{data}</div>;
}`;

  const apiCode = `// app/api/hello/route.ts
export const runtime = 'edge';

export async function GET(request: Request) {
  return new Response(
    JSON.stringify({ message: 'Hello from the edge!' }),
    { headers: { 'content-type': 'application/json' } }
  );
}`;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-12 px-4">
      <DemoCard
        title="Edge Runtime"
        description="Serverless at the Edge"
        renderMethod="Edge Runtime"
        timestamp={edgeInfo.timestamp}
        badge="Ultra-Fast"
        badgeColor="bg-teal-600"
      >
        {/* Explanation */}
        <div className="bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-teal-900 dark:text-teal-100 mb-3">
            How Edge Runtime Works
          </h3>
          <ul className="space-y-2 text-teal-800 dark:text-teal-200">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Code runs on edge servers close to users globally</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>
                Ultra-low latency - faster than traditional serverless
              </span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Lightweight runtime with limited Node.js APIs</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Perfect for simple, fast operations</span>
            </li>
          </ul>
        </div>

        {/* Edge Info */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 border border-zinc-200 dark:border-zinc-700">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
            Edge Runtime Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-teal-500 to-cyan-500 text-white rounded-lg p-6">
              <p className="text-sm mb-2">Runtime Environment</p>
              <p className="text-2xl font-bold uppercase">{edgeInfo.runtime}</p>
            </div>
            <div className="bg-gradient-to-br from-blue-500 to-indigo-500 text-white rounded-lg p-6">
              <p className="text-sm mb-2">Region</p>
              <p className="text-2xl font-bold uppercase">{edgeInfo.region}</p>
            </div>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-4">
            This page is served from an edge server. In production on Vercel, it
            would show your nearest region.
          </p>
        </div>

        {/* Code Examples */}
        <div className="space-y-4">
          <CodeBlock title="Page Configuration" code={configCode} />
          <CodeBlock title="API Route with Edge Runtime" code={apiCode} />
        </div>

        {/* Limitations */}
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-100 mb-3">
            ⚠️ Edge Runtime Limitations
          </h3>
          <ul className="space-y-2 text-amber-800 dark:text-amber-200">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Limited Node.js APIs (no fs, child_process, etc.)</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Smaller bundle size limits</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Cannot use native Node.js modules</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Best for simple, fast operations</span>
            </li>
          </ul>
        </div>

        {/* Comparison */}
        <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-6 border border-zinc-300 dark:border-zinc-700">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
            Edge vs Node.js Runtime
          </h3>
          <div className="space-y-3 text-sm">
            <div>
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                🌐 Edge Runtime:
              </p>
              <p className="text-zinc-600 dark:text-zinc-400">
                Ultra-fast, globally distributed, limited APIs, perfect for
                simple operations
              </p>
            </div>
            <div>
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                🖥️ Node.js Runtime:
              </p>
              <p className="text-zinc-600 dark:text-zinc-400">
                Full Node.js APIs, larger bundles, centralized, better for
                complex operations
              </p>
            </div>
          </div>
        </div>

        {/* Use Cases */}
        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-3">
            ✅ Best Use Cases
          </h3>
          <ul className="space-y-2 text-green-800 dark:text-green-200">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>
                API routes with simple logic (authentication, redirects)
              </span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Middleware for request/response manipulation</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>A/B testing and feature flags</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Geo-location based content</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Simple data transformations</span>
            </li>
          </ul>
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center pt-4 border-t border-zinc-200 dark:border-zinc-700">
          <Link
            href="/streaming"
            className="text-teal-600 dark:text-teal-400 hover:underline"
          >
            ← Previous: Streaming
          </Link>
          <Link
            href="/"
            className="text-teal-600 dark:text-teal-400 hover:underline"
          >
            Back to Home →
          </Link>
        </div>
      </DemoCard>
    </div>
  );
}

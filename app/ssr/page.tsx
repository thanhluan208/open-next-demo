import DemoCard from "@/components/DemoCard";
import CodeBlock from "@/components/CodeBlock";
import Link from "next/link";

// This page uses SSR (Server-Side Rendering)
// It's rendered on every request

async function getData() {
  // This runs on every request
  const requestTime = new Date().toISOString();
  const randomData = {
    temperature: (Math.random() * 30 + 10).toFixed(1),
    visitors: Math.floor(Math.random() * 1000),
  };

  return { requestTime, ...randomData };
}

// Force dynamic rendering
export const dynamic = "force-dynamic";

export default async function SSRPage() {
  const data = await getData();

  const configCode = `// Force SSR with dynamic option
export const dynamic = 'force-dynamic';

export default async function SSRPage() {
  // This runs on EVERY request
  const data = await fetchData();
  return <div>{data}</div>;
}`;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-12 px-4">
      <DemoCard
        title="Server-Side Rendering (SSR)"
        description="Rendered on Every Request"
        renderMethod="SSR - Server-Side Rendering"
        timestamp={data.requestTime}
        badge="Always Fresh"
        badgeColor="bg-green-600"
      >
        {/* Explanation */}
        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-3">
            How SSR Works
          </h3>
          <ul className="space-y-2 text-green-800 dark:text-green-200">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>
                Page is rendered on the server for{" "}
                <strong>every request</strong>
              </span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Always serves fresh, up-to-date content</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Perfect for personalized or real-time data</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Refresh the page - timestamp updates every time!</span>
            </li>
          </ul>
        </div>

        {/* Live Demo */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 border border-zinc-200 dark:border-zinc-700">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
            Real-Time Data Example
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-green-500 to-emerald-500 text-white rounded-lg p-6 text-center">
              <p className="text-sm mb-2">Current Temperature</p>
              <p className="text-4xl font-bold">{data.temperature}°C</p>
            </div>
            <div className="bg-gradient-to-br from-blue-500 to-cyan-500 text-white rounded-lg p-6 text-center">
              <p className="text-sm mb-2">Active Visitors</p>
              <p className="text-4xl font-bold">{data.visitors}</p>
            </div>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-3">
            These values are generated fresh on every page request. Refresh to
            see them change!
          </p>
        </div>

        {/* Code Example */}
        <CodeBlock title="Configuration Example" code={configCode} />

        {/* Testing Instructions */}
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">
            🧪 Try It Yourself
          </h3>
          <ol className="space-y-2 text-blue-800 dark:text-blue-200 list-decimal list-inside">
            <li>Note the timestamp and data values above</li>
            <li>Refresh the page (F5 or Cmd+R)</li>
            <li>Notice all values update immediately</li>
            <li>Every refresh triggers a new server render</li>
          </ol>
        </div>

        {/* Comparison */}
        <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-6 border border-zinc-300 dark:border-zinc-700">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
            SSR vs SSG/ISR
          </h3>
          <div className="space-y-3 text-sm">
            <div>
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                ⚡ SSG/ISR:
              </p>
              <p className="text-zinc-600 dark:text-zinc-400">
                Faster response, cached content, eventual consistency
              </p>
            </div>
            <div>
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                🔄 SSR:
              </p>
              <p className="text-zinc-600 dark:text-zinc-400">
                Slower response, always fresh, immediate consistency
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
              <span>Personalized dashboards and user profiles</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Real-time data displays (stock prices, sports scores)</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Pages requiring authentication or user-specific data</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Content that must always be up-to-date</span>
            </li>
          </ul>
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center pt-4 border-t border-zinc-200 dark:border-zinc-700">
          <Link
            href="/isr-on-demand"
            className="text-green-600 dark:text-green-400 hover:underline"
          >
            ← Previous: On-Demand ISR
          </Link>
          <Link
            href="/streaming"
            className="text-green-600 dark:text-green-400 hover:underline"
          >
            Next: Streaming →
          </Link>
        </div>
      </DemoCard>
    </div>
  );
}

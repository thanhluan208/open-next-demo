import DemoCard from "@/components/DemoCard";
import CodeBlock from "@/components/CodeBlock";
import Link from "next/link";

// This page uses Incremental Static Regeneration (ISR)
// It's statically generated but revalidates periodically

async function getData() {
  // Simulate data fetching
  const generatedAt = new Date().toISOString();
  const randomNumber = Math.floor(Math.random() * 1000);

  return { generatedAt, randomNumber };
}

export const revalidate = 60; // Revalidate every 60 seconds

export default async function ISRPage() {
  const data = await getData();

  const configCode = `// Enable ISR with revalidate option
export const revalidate = 60; // seconds

export default async function ISRPage() {
  const data = await fetchData();
  return <div>{data}</div>;
}`;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-12 px-4">
      <DemoCard
        title="Incremental Static Regeneration (ISR)"
        description="Static with Periodic Updates"
        renderMethod="ISR - Incremental Static Regeneration"
        timestamp={data.generatedAt}
        badge="Revalidate: 60s"
        badgeColor="bg-purple-600"
      >
        {/* Explanation */}
        <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100 mb-3">
            How ISR Works
          </h3>
          <ul className="space-y-2 text-purple-800 dark:text-purple-200">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Page is initially generated at build time (like SSG)</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>
                After 60 seconds, the next request triggers regeneration
              </span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>
                Stale content is served while regenerating in background
              </span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>
                Fresh content is cached and served to subsequent visitors
              </span>
            </li>
          </ul>
        </div>

        {/* Live Demo */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 border border-zinc-200 dark:border-zinc-700">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
            Dynamic Content Example
          </h3>
          <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg p-6 text-center">
            <p className="text-sm mb-2">
              Random Number (Generated at Page Creation)
            </p>
            <p className="text-5xl font-bold">{data.randomNumber}</p>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-3">
            This number was generated when the page was last regenerated. Wait
            60+ seconds and refresh to see it potentially update!
          </p>
        </div>

        {/* Code Example */}
        <CodeBlock title="Configuration Example" code={configCode} />

        {/* Testing Instructions */}
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-100 mb-3">
            🧪 Try It Yourself
          </h3>
          <ol className="space-y-2 text-amber-800 dark:text-amber-200 list-decimal list-inside">
            <li>Note the timestamp and random number above</li>
            <li>
              Refresh the page immediately - values stay the same (cached)
            </li>
            <li>Wait 60+ seconds</li>
            <li>Refresh again - the next request triggers regeneration</li>
            <li>Refresh once more - you'll see the updated values</li>
          </ol>
        </div>

        {/* Use Cases */}
        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-3">
            ✅ Best Use Cases
          </h3>
          <ul className="space-y-2 text-green-800 dark:text-green-200">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>E-commerce product pages</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>News articles and blog posts with view counts</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Content that updates periodically but not constantly</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Balance between performance and freshness</span>
            </li>
          </ul>
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center pt-4 border-t border-zinc-200 dark:border-zinc-700">
          <Link
            href="/ssg"
            className="text-purple-600 dark:text-purple-400 hover:underline"
          >
            ← Previous: SSG
          </Link>
          <Link
            href="/isr-on-demand"
            className="text-purple-600 dark:text-purple-400 hover:underline"
          >
            Next: On-Demand ISR →
          </Link>
        </div>
      </DemoCard>
    </div>
  );
}

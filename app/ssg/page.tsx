import DemoCard from "@/components/DemoCard";
import CodeBlock from "@/components/CodeBlock";
import Link from "next/link";

// This page uses Static Site Generation (SSG)
// It's pre-rendered at build time and served as static HTML

async function getStaticData() {
  // Simulate data fetching at build time
  const buildTime = new Date().toISOString();
  const randomQuote = [
    "The only way to do great work is to love what you do. - Steve Jobs",
    "Innovation distinguishes between a leader and a follower. - Steve Jobs",
    "Stay hungry, stay foolish. - Steve Jobs",
    "Code is like humor. When you have to explain it, it's bad. - Cory House",
  ][Math.floor(Math.random() * 4)];

  return { buildTime, randomQuote };
}

export default async function SSGPage() {
  const data = await getStaticData();

  const configCode = `// This page is statically generated at build time
export default async function SSGPage() {
  // Data is fetched once during build
  const data = await fetchData();
  
  return <div>{data}</div>;
}`;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-12 px-4">
      <DemoCard
        title="Static Site Generation (SSG)"
        description="Pre-rendered at Build Time"
        renderMethod="SSG - Static Site Generation"
        timestamp={data.buildTime}
        badge="Fastest"
        badgeColor="bg-blue-600"
      >
        {/* Explanation */}
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">
            How SSG Works
          </h3>
          <ul className="space-y-2 text-blue-800 dark:text-blue-200">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>
                Page is generated once at <strong>build time</strong>
              </span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Served as static HTML - extremely fast</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Timestamp above shows when the build occurred</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>
                Refresh the page - timestamp won't change (it's static!)
              </span>
            </li>
          </ul>
        </div>

        {/* Static Content Demo */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 border border-zinc-200 dark:border-zinc-700">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
            Static Content Example
          </h3>
          <blockquote className="italic text-zinc-700 dark:text-zinc-300 border-l-4 border-blue-500 pl-4">
            "{data.randomQuote}"
          </blockquote>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-3">
            This quote was randomly selected at build time and will remain the
            same until you rebuild.
          </p>
        </div>

        {/* Code Example */}
        <CodeBlock title="Configuration Example" code={configCode} />

        {/* Use Cases */}
        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-3">
            ✅ Best Use Cases
          </h3>
          <ul className="space-y-2 text-green-800 dark:text-green-200">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Marketing pages and landing pages</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Blog posts and documentation</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Content that doesn't change frequently</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Maximum performance requirements</span>
            </li>
          </ul>
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center pt-4 border-t border-zinc-200 dark:border-zinc-700">
          <Link
            href="/"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            ← Back to Home
          </Link>
          <Link
            href="/isr"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Next: ISR →
          </Link>
        </div>
      </DemoCard>
    </div>
  );
}

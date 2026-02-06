import { Suspense } from "react";
import DemoCard from "@/components/DemoCard";
import CodeBlock from "@/components/CodeBlock";
import Link from "next/link";

// Simulate slow data fetching
async function getSlowData(delay: number, label: string) {
  await new Promise((resolve) => setTimeout(resolve, delay));
  return {
    label,
    loadedAt: new Date().toISOString(),
    delay,
  };
}

// Fast component - loads immediately
async function FastContent() {
  const data = await getSlowData(100, "Fast Content");
  return (
    <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg p-6">
      <h3 className="text-xl font-bold mb-2">⚡ {data.label}</h3>
      <p className="text-sm">Loaded in {data.delay}ms</p>
      <p className="text-xs mt-2 opacity-80">{data.loadedAt}</p>
    </div>
  );
}

// Medium speed component
async function MediumContent() {
  const data = await getSlowData(2000, "Medium Content");
  return (
    <div className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg p-6">
      <h3 className="text-xl font-bold mb-2">🔄 {data.label}</h3>
      <p className="text-sm">Loaded in {data.delay}ms</p>
      <p className="text-xs mt-2 opacity-80">{data.loadedAt}</p>
    </div>
  );
}

// Slow component - takes longest to load
async function SlowContent() {
  const data = await getSlowData(4000, "Slow Content");
  return (
    <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg p-6">
      <h3 className="text-xl font-bold mb-2">🐌 {data.label}</h3>
      <p className="text-sm">Loaded in {data.delay}ms</p>
      <p className="text-xs mt-2 opacity-80">{data.loadedAt}</p>
    </div>
  );
}

// Loading fallback component
function LoadingBox({ label }: { label: string }) {
  return (
    <div className="bg-zinc-200 dark:bg-zinc-700 rounded-lg p-6 animate-pulse">
      <div className="h-6 bg-zinc-300 dark:bg-zinc-600 rounded w-3/4 mb-2"></div>
      <div className="h-4 bg-zinc-300 dark:bg-zinc-600 rounded w-1/2"></div>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
        Loading {label}...
      </p>
    </div>
  );
}

export default async function StreamingPage() {
  const pageLoadTime = new Date().toISOString();

  const configCode = `import { Suspense } from 'react';

export default function StreamingPage() {
  return (
    <div>
      {/* Fast content loads immediately */}
      <Suspense fallback={<Loading />}>
        <FastContent />
      </Suspense>
      
      {/* Slow content streams in later */}
      <Suspense fallback={<Loading />}>
        <SlowContent />
      </Suspense>
    </div>
  );
}`;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-12 px-4">
      <DemoCard
        title="Streaming with React Suspense"
        description="Progressive Rendering"
        renderMethod="Streaming - Progressive Rendering"
        timestamp={pageLoadTime}
        badge="Progressive"
        badgeColor="bg-indigo-600"
      >
        {/* Explanation */}
        <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-indigo-900 dark:text-indigo-100 mb-3">
            How Streaming Works
          </h3>
          <ul className="space-y-2 text-indigo-800 dark:text-indigo-200">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Page shell is sent immediately to the browser</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>
                Fast content appears first, slow content streams in
                progressively
              </span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>
                Users see something immediately instead of waiting for
                everything
              </span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Improves perceived performance significantly</span>
            </li>
          </ul>
        </div>

        {/* Live Demo */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 border border-zinc-200 dark:border-zinc-700">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
            Progressive Loading Demo
          </h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            Watch as content loads progressively. Fast content appears first,
            then medium, then slow.
          </p>

          <div className="space-y-4">
            {/* Fast content - loads in 100ms */}
            <Suspense fallback={<LoadingBox label="fast content" />}>
              <FastContent />
            </Suspense>

            {/* Medium content - loads in 2s */}
            <Suspense fallback={<LoadingBox label="medium content" />}>
              <MediumContent />
            </Suspense>

            {/* Slow content - loads in 4s */}
            <Suspense fallback={<LoadingBox label="slow content" />}>
              <SlowContent />
            </Suspense>
          </div>
        </div>

        {/* Code Example */}
        <CodeBlock title="Configuration Example" code={configCode} />

        {/* Testing Instructions */}
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">
            🧪 Try It Yourself
          </h3>
          <ol className="space-y-2 text-blue-800 dark:text-blue-200 list-decimal list-inside">
            <li>Refresh the page and watch the loading sequence</li>
            <li>Notice the page shell appears immediately</li>
            <li>Fast content (100ms) appears almost instantly</li>
            <li>Medium content (2s) streams in next</li>
            <li>Slow content (4s) appears last</li>
            <li>
              Open DevTools Network tab and throttle to "Slow 3G" to see it more
              clearly
            </li>
          </ol>
        </div>

        {/* Benefits */}
        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-3">
            ✅ Benefits of Streaming
          </h3>
          <ul className="space-y-2 text-green-800 dark:text-green-200">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>
                <strong>Improved perceived performance</strong> - Users see
                content faster
              </span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>
                <strong>Better UX</strong> - No blank screen while waiting
              </span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>
                <strong>Parallel data fetching</strong> - Multiple requests
                happen simultaneously
              </span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>
                <strong>SEO friendly</strong> - Content is still server-rendered
              </span>
            </li>
          </ul>
        </div>

        {/* Use Cases */}
        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-3">
            ✅ Best Use Cases
          </h3>
          <ul className="space-y-2 text-green-800 dark:text-green-200">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Dashboards with multiple data sources</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Pages with slow API calls or database queries</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Product pages with reviews, recommendations, etc.</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>
                Any page where some content is slower to fetch than others
              </span>
            </li>
          </ul>
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center pt-4 border-t border-zinc-200 dark:border-zinc-700">
          <Link
            href="/ssr"
            className="text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            ← Previous: SSR
          </Link>
          <Link
            href="/edge"
            className="text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Next: Edge Runtime →
          </Link>
        </div>
      </DemoCard>
    </div>
  );
}

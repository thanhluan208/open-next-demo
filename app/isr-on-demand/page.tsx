"use client";

import { useState } from "react";
import DemoCard from "@/components/DemoCard";
import CodeBlock from "@/components/CodeBlock";
import Link from "next/link";

export default function OnDemandISRPage() {
  const [revalidating, setRevalidating] = useState(false);
  const [lastRevalidated, setLastRevalidated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // This would be the cached timestamp from the server
  const cachedTime = new Date().toISOString();

  const handleRevalidate = async () => {
    setRevalidating(true);
    setError(null);

    try {
      const response = await fetch("/api/revalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "/isr-on-demand" }),
      });

      const data = await response.json();

      if (response.ok) {
        setLastRevalidated(new Date().toISOString());
        // Refresh the page to show new content
        window.location.reload();
      } else {
        setError(data.error || "Failed to revalidate");
      }
    } catch (err) {
      setError("Network error occurred");
    } finally {
      setRevalidating(false);
    }
  };

  const pageCode = `// app/isr-on-demand/page.tsx
export const revalidate = false; // or a long time

export default async function Page() {
  const data = await fetchData();
  return <div>{data}</div>;
}`;

  const apiCode = `// app/api/revalidate/route.ts
import { revalidatePath } from 'next/cache';

export async function POST(request: Request) {
  const { path } = await request.json();
  
  // Trigger revalidation
  revalidatePath(path);
  
  return Response.json({ 
    revalidated: true, 
    now: Date.now() 
  });
}`;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-12 px-4">
      <DemoCard
        title="On-Demand ISR"
        description="Manual Revalidation via API"
        renderMethod="On-Demand ISR"
        timestamp={cachedTime}
        badge="On-Demand"
        badgeColor="bg-orange-600"
      >
        {/* Explanation */}
        <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-orange-900 dark:text-orange-100 mb-3">
            How On-Demand ISR Works
          </h3>
          <ul className="space-y-2 text-orange-800 dark:text-orange-200">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Page is statically generated (like SSG/ISR)</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>You manually trigger revalidation via API call</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Perfect for CMS webhooks or content updates</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>
                Update static pages only when content actually changes
              </span>
            </li>
          </ul>
        </div>

        {/* Interactive Demo */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 border border-zinc-200 dark:border-zinc-700">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
            Interactive Revalidation Demo
          </h3>

          <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg p-6 mb-4">
            <p className="text-sm mb-2">Current Cached Content</p>
            <p className="text-xs opacity-80 mb-3">
              This page was generated at:
            </p>
            <p className="text-lg font-mono">{cachedTime}</p>
          </div>

          <button
            onClick={handleRevalidate}
            disabled={revalidating}
            className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {revalidating ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Revalidating...
              </>
            ) : (
              <>⚡ Trigger Revalidation</>
            )}
          </button>

          {lastRevalidated && (
            <div className="mt-4 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded text-green-800 dark:text-green-200 text-sm">
              ✅ Successfully revalidated at {lastRevalidated}
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded text-red-800 dark:text-red-200 text-sm">
              ❌ Error: {error}
            </div>
          )}

          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-4">
            Click the button above to trigger revalidation. The page will
            regenerate and reload with a new timestamp.
          </p>
        </div>

        {/* Code Examples */}
        <div className="space-y-4">
          <CodeBlock title="Page Configuration" code={pageCode} />
          <CodeBlock title="Revalidation API Route" code={apiCode} />
        </div>

        {/* Workflow */}
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">
            🔄 Typical Workflow
          </h3>
          <ol className="space-y-2 text-blue-800 dark:text-blue-200 list-decimal list-inside">
            <li>Content is updated in your CMS</li>
            <li>CMS sends webhook to your API route</li>
            <li>
              API route calls{" "}
              <code className="bg-blue-200 dark:bg-blue-900 px-1 rounded">
                revalidatePath()
              </code>
            </li>
            <li>Next.js regenerates the static page</li>
            <li>New content is served to visitors</li>
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
              <span>CMS-driven websites (Contentful, Sanity, etc.)</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>E-commerce product pages (update on inventory change)</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Blog posts (revalidate when published/updated)</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>
                Any content that updates infrequently but needs to be fresh
              </span>
            </li>
          </ul>
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center pt-4 border-t border-zinc-200 dark:border-zinc-700">
          <Link
            href="/isr"
            className="text-orange-600 dark:text-orange-400 hover:underline"
          >
            ← Previous: ISR
          </Link>
          <Link
            href="/ssr"
            className="text-orange-600 dark:text-orange-400 hover:underline"
          >
            Next: SSR →
          </Link>
        </div>
      </DemoCard>
    </div>
  );
}

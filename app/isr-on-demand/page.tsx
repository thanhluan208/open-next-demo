import DemoCard from "@/components/DemoCard";
import CodeBlock from "@/components/CodeBlock";
import Link from "next/link";
import ISRControl from "./isr-control";

// For pure on-demand ISR: no automatic revalidation, only manual via API
export const revalidate = false;

// This function runs at build time AND when the page is revalidated
async function getPageData() {
  const cachedTime = new Date().toISOString();
  return { cachedTime };
}

export default async function OnDemandISRPage() {
  const { cachedTime } = await getPageData();

  const pageCode = `// app/isr-on-demand/page.tsx
export const dynamic = 'force-static';
export const revalidate = false; // On-demand only

async function getPageData() {
  const timestamp = new Date().toISOString();
  return { timestamp };
}

export default async function Page() {
  const { timestamp } = await getPageData();
  // This timestamp is generated at build time
  // AND when revalidated via revalidatePath()
  return <ClientComponent timestamp={timestamp} />;
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
        <ISRControl timestamp={cachedTime} />

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

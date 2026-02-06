import Link from "next/link";

export default function Navigation() {
  const demos = [
    { name: "SSG", path: "/ssg", description: "Static Site Generation" },
    {
      name: "ISR",
      path: "/isr",
      description: "Incremental Static Regeneration",
    },
    {
      name: "On-Demand ISR",
      path: "/isr-on-demand",
      description: "Manual Revalidation",
    },
    { name: "SSR", path: "/ssr", description: "Server-Side Rendering" },
    {
      name: "Streaming",
      path: "/streaming",
      description: "Progressive Rendering",
    },
    { name: "Edge", path: "/edge", description: "Edge Runtime" },
  ];

  return (
    <nav className="w-full border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link
            href="/"
            className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
          >
            Next.js Rendering Demos
          </Link>
          <div className="hidden md:flex items-center gap-6">
            {demos.map((demo) => (
              <Link
                key={demo.path}
                href={demo.path}
                className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                title={demo.description}
              >
                {demo.name}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}

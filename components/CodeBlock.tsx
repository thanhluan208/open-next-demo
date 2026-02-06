interface CodeBlockProps {
  code: string;
  language?: string;
  title?: string;
}

export default function CodeBlock({
  code,
  language = "typescript",
  title,
}: CodeBlockProps) {
  return (
    <div className="rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700">
      {title && (
        <div className="bg-zinc-100 dark:bg-zinc-800 px-4 py-2 border-b border-zinc-200 dark:border-zinc-700">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {title}
          </p>
        </div>
      )}
      <pre className="bg-zinc-50 dark:bg-zinc-900 p-4 overflow-x-auto">
        <code className="text-sm font-mono text-zinc-800 dark:text-zinc-200">
          {code}
        </code>
      </pre>
    </div>
  );
}

import { ReactNode } from "react";

interface DemoCardProps {
  title: string;
  description: string;
  renderMethod: string;
  timestamp?: string;
  children?: ReactNode;
  badge?: string;
  badgeColor?: string;
}

export default function DemoCard({
  title,
  description,
  renderMethod,
  timestamp,
  children,
  badge,
  badgeColor = "bg-blue-500",
}: DemoCardProps) {
  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 text-white">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">{title}</h1>
              <p className="text-blue-100 text-lg">{description}</p>
            </div>
            {badge && (
              <span
                className={`${badgeColor} px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap`}
              >
                {badge}
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Render Method Info */}
          <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4 border border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">
                  Rendering Method
                </p>
                <p className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                  {renderMethod}
                </p>
              </div>
              {timestamp && (
                <div className="text-right">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">
                    Generated At
                  </p>
                  <p className="text-lg font-mono text-zinc-900 dark:text-zinc-100">
                    {timestamp}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Additional Content */}
          {children && <div className="space-y-4">{children}</div>}
        </div>
      </div>
    </div>
  );
}

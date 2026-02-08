"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ISRControlProps {
  timestamp: string;
}

export default function ISRControl({ timestamp }: ISRControlProps) {
  const router = useRouter();
  const [revalidating, setRevalidating] = useState(false);
  const [lastRevalidated, setLastRevalidated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        // Refresh the page to show new content from the server
        router.refresh();
      } else {
        setError(data.error || "Failed to revalidate");
      }
    } catch (err) {
      setError("Network error occurred");
    } finally {
      setRevalidating(false);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 border border-zinc-200 dark:border-zinc-700">
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
        Interactive Revalidation Demo
      </h3>

      <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg p-6 mb-4">
        <p className="text-sm mb-2">Current Cached Content</p>
        <p className="text-xs opacity-80 mb-3">This page was generated at:</p>
        <p className="text-lg font-mono">{timestamp}</p>
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
        Click the button above to trigger revalidation. The page will regenerate
        and reload with a new timestamp.
      </p>
    </div>
  );
}

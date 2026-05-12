"use client";

import { BarChart3, ExternalLink } from "lucide-react";

const UMAMI_SHARE_URL = process.env.NEXT_PUBLIC_UMAMI_SHARE_URL || "";

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">
            Web analytics via Umami — page views, events, funnels
          </p>
        </div>
        {UMAMI_SHARE_URL && (
          <a
            href={UMAMI_SHARE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            <ExternalLink size={16} />
            Open in Umami
          </a>
        )}
      </div>

      {UMAMI_SHARE_URL ? (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <iframe
            src={UMAMI_SHARE_URL}
            className="w-full border-0"
            style={{ height: "calc(100vh - 200px)", minHeight: "600px" }}
            title="Umami Analytics"
            loading="lazy"
          />
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <BarChart3 size={48} className="mx-auto text-gray-300 mb-4" />
          <h2 className="text-lg font-semibold text-gray-900">Umami not configured</h2>
          <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
            Set <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">NEXT_PUBLIC_UMAMI_SHARE_URL</code> in the
            admin app environment variables to display the Umami dashboard here.
          </p>
          <div className="mt-6 text-left max-w-lg mx-auto text-sm text-gray-600 space-y-3">
            <p className="font-semibold text-gray-900">Setup steps:</p>
            <ol className="list-decimal list-inside space-y-2">
              <li>Log into Umami at <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">stats.example.com</code></li>
              <li>Go to Settings → Websites → Share</li>
              <li>Generate a share URL for the website</li>
              <li>Add the URL as an environment variable in Coolify</li>
              <li>Redeploy the admin app</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
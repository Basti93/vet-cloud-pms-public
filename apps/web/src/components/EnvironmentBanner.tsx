'use client';

import { isProduction, getEnvironmentLabel } from '@/lib/env';

export function EnvironmentBanner() {
  if (isProduction()) {
    return null;
  }

  const label = getEnvironmentLabel();
  const isDev = label === 'Development';

  return (
    <div
      className={`w-full py-2 px-4 text-center text-sm font-medium ${
        isDev
          ? 'bg-yellow-100 text-yellow-900 border-b-2 border-yellow-300'
          : 'bg-blue-100 text-blue-900 border-b-2 border-blue-300'
      }`}
    >
      ⚠️ {label} Environment - Using Test Database & Clerk
    </div>
  );
}

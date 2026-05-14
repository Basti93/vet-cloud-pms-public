'use client';

import type { ReactNode } from 'react';
import type { ResolvedWebsitePage } from '@/lib/website-platform/types';
import { getBookingUrl } from '@/lib/website-platform/capabilities';

export function PraxisLayout({ resolved, children }: { resolved: ResolvedWebsitePage; children: ReactNode }) {
  const bookingUrl = getBookingUrl(resolved.project.capabilities);
  const basePath = `/site/${resolved.project.slug}`;
  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <a href={basePath} className="font-bold" style={{ fontFamily: 'var(--font-heading)' }}>{resolved.project.name}</a>
          <nav className="hidden items-center gap-5 text-sm text-muted sm:flex">
            <a href={`${basePath}#leistungen`}>Leistungen</a>
            <a href={`${basePath}#kontakt`}>Kontakt</a>
            {bookingUrl && <a href={bookingUrl} className="rounded-full bg-[var(--color-accent)] px-4 py-2 font-semibold text-white">Termin buchen</a>}
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-[var(--color-border)] bg-white py-8 text-sm text-muted">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} {resolved.project.name}</p>
          <div className="flex gap-4"><a href={`${basePath}/impressum`}>Impressum</a><a href={`${basePath}/datenschutz`}>Datenschutz</a></div>
        </div>
      </footer>
    </div>
  );
}

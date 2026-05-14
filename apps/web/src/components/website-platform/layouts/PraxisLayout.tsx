'use client';

/* eslint-disable @next/next/no-img-element */

import { useState } from 'react';
import type { ReactNode } from 'react';
import type { ResolvedWebsitePage } from '@/lib/website-platform/types';
import { getBookingUrl } from '@/lib/website-platform/capabilities';
import { generateThemeStyles, getPrimaryHex } from '@/lib/theme-utils';
import { resolveAssetUrl } from '@/lib/website-platform/assets';
import { BookingDialog } from '@/components/website-platform/blocks/WebsiteBlocks';

const FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@400;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&family=Public+Sans:wght@400;500;600;700&display=swap';

export function PraxisLayout({ resolved, assetMap, children }: { resolved: ResolvedWebsitePage; assetMap?: Record<string, string>; children?: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const bookingUrl = getBookingUrl(resolved.project.capabilities);
  const pmsSlug = resolved.project.capabilities.booking.enabled && resolved.project.capabilities.booking.mode === 'pms'
    ? resolved.project.capabilities.booking.tenantSlug
    : null;
  const basePath = `/site/${resolved.project.slug}`;
  const phone = resolved.project.tenantContactInfo?.phone;
  const themeStyles = generateThemeStyles(
    resolved.project.themeConfig.palette,
    resolved.project.themeConfig.typography,
    { radius: resolved.project.themeConfig.radius, density: resolved.project.themeConfig.density },
  );
  const logoUrl = resolveAssetUrl(resolved.project.logoAsset ?? null, assetMap);
  const monogram = resolved.project.tenantMonogram || resolved.project.name.charAt(0).toUpperCase();
  const accentHex = getPrimaryHex(resolved.project.themeConfig.palette);
  const faviconSvg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='22' fill='${accentHex}'/><text x='50' y='54' font-size='${monogram.length > 1 ? 38 : 58}' font-family='Georgia,serif' font-weight='bold' fill='white' text-anchor='middle' dominant-baseline='central'>${monogram}</text></svg>`;
  const faviconHref = logoUrl ?? `data:image/svg+xml,${encodeURIComponent(faviconSvg)}`;

  const navItems = [
    { label: 'Start', href: `${basePath}#start` },
    { label: 'Über uns', href: `${basePath}#team` },
    { label: 'Leistungen', href: `${basePath}#leistungen` },
    { label: 'Sprechzeiten', href: `${basePath}#sprechzeiten` },
    { label: 'Kontakt', href: `${basePath}#kontakt` },
  ];

  return (
    <div style={{ ...themeStyles, fontFamily: 'var(--font-body)', color: 'var(--color-fg)', background: 'var(--color-bg)' }} className="min-h-screen">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="stylesheet" href={FONTS_HREF} />
      <link rel="icon" href={faviconHref} />

      {/* Custom CSS override */}
      {resolved.project.customCss && (
        <style dangerouslySetInnerHTML={{ __html: resolved.project.customCss }} />
      )}

      {/* Navbar */}
      <header
        className="sticky top-0 z-40 border-b"
        style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(10px)', borderColor: 'var(--color-border)' }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          {/* Logo / monogram */}
          <a href={`${basePath}#start`} className="flex items-center gap-2.5">
            {logoUrl ? (
              <img src={logoUrl} alt={resolved.project.name} className="h-9 w-auto object-contain" />
            ) : (
              <span
                className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold text-white"
                style={{ background: 'var(--color-accent)', fontFamily: 'Georgia,serif' }}
              >
                {monogram}
              </span>
            )}
            <span className="text-lg font-bold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-fg)' }}>
              {resolved.project.name}
            </span>
          </a>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:text-[var(--color-accent)]"
                style={{ color: 'var(--color-fg)' }}
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden items-center gap-2 md:flex">
            {phone && (
              <a
                href={`tel:${phone.replace(/\s/g, '')}`}
                className="flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition-colors"
                style={{ borderColor: 'var(--color-accent)', color: 'var(--color-accent-text)' }}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 6.75Z" />
                </svg>
                {phone}
              </a>
            )}
            {bookingUrl && (
              pmsSlug ? (
                <button
                  onClick={() => setBookingOpen(true)}
                  className="cursor-pointer rounded-full px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: 'var(--color-secondary, var(--color-accent))' }}
                >
                  Termin buchen
                </button>
              ) : (
                <a
                  href={bookingUrl}
                  className="rounded-full px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: 'var(--color-secondary, var(--color-accent))' }}
                >
                  Termin buchen
                </a>
              )
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="rounded-lg p-2 md:hidden"
            style={{ color: 'var(--color-accent)' }}
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Menü"
          >
            {menuOpen ? (
              <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile drawer */}
        {menuOpen && (
          <div className="border-t px-4 py-4 md:hidden" style={{ background: 'white', borderColor: 'var(--color-border)' }}>
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--color-muted-soft)]"
                  style={{ color: 'var(--color-fg)' }}
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="mt-4 flex flex-col gap-2">
              {bookingUrl && (
                pmsSlug ? (
                  <button
                    onClick={() => { setMenuOpen(false); setBookingOpen(true); }}
                    className="cursor-pointer rounded-full py-3 text-center text-sm font-semibold text-white"
                    style={{ background: 'var(--color-secondary, var(--color-accent))' }}
                  >
                    Termin buchen
                  </button>
                ) : (
                  <a
                    href={bookingUrl}
                    onClick={() => setMenuOpen(false)}
                    className="cursor-pointer rounded-full py-3 text-center text-sm font-semibold text-white"
                    style={{ background: 'var(--color-secondary, var(--color-accent))' }}
                  >
                    Termin buchen
                  </a>
                )
              )}
              {phone && (
                <a
                  href={`tel:${phone.replace(/\s/g, '')}`}
                  className="rounded-full border py-3 text-center text-sm font-semibold"
                  style={{ borderColor: 'var(--color-accent)', color: 'var(--color-accent-text)' }}
                >
                  {phone}
                </a>
              )}
            </div>
          </div>
        )}
      </header>

      <main>{children}</main>

      {/* Footer */}
      <footer style={{ background: '#1a2e1c', color: 'rgba(255,255,255,0.8)' }} className="pt-12 pb-6">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {/* Col 1: practice info */}
            <div>
              <h3 className="mb-3 font-bold text-white">{resolved.project.name}</h3>
              {resolved.project.tenantContactInfo && (
                <p className="text-sm leading-loose">
                  {resolved.project.tenantContactInfo.address && (
                    <>{resolved.project.tenantContactInfo.address}<br /></>
                  )}
                  {resolved.project.tenantContactInfo.city && (
                    <>{resolved.project.tenantContactInfo.city}<br /></>
                  )}
                  {resolved.project.tenantContactInfo.phone && (
                    <a
                      href={`tel:${resolved.project.tenantContactInfo.phone.replace(/\s/g, '')}`}
                      style={{ color: 'rgba(255,255,255,0.8)' }}
                    >
                      {resolved.project.tenantContactInfo.phone}
                    </a>
                  )}
                </p>
              )}
            </div>

            {/* Col 2: hours */}
            {resolved.project.tenantHoursRows && resolved.project.tenantHoursRows.length > 0 && (
              <div>
                <h3 className="mb-3 font-bold text-white">Öffnungszeiten</h3>
                <div className="space-y-1 text-sm">
                  {resolved.project.tenantHoursRows.map((row) => (
                    <div key={`${row.days}-${row.time}`} className="flex justify-between gap-4">
                      <span>{row.days}</span>
                      <span style={{ color: 'rgba(255,255,255,0.6)' }}>{row.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Col 3: legal */}
            <div>
              <h3 className="mb-3 font-bold text-white">Rechtliches</h3>
              <div className="flex flex-col gap-2 text-sm">
                <a
                  href={`${basePath}/impressum`}
                  className="transition-colors hover:text-white"
                  style={{ color: 'rgba(255,255,255,0.7)' }}
                >
                  Impressum
                </a>
                <a
                  href={`${basePath}/datenschutz`}
                  className="transition-colors hover:text-white"
                  style={{ color: 'rgba(255,255,255,0.7)' }}
                >
                  Datenschutzerklärung
                </a>
              </div>
            </div>
          </div>

          <div
            className="mt-8 pt-4 text-center text-xs"
            style={{ borderTop: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}
          >
            © {new Date().getFullYear()} {resolved.project.name} — Mit ♥ für Ihre Tiere
          </div>
        </div>
      </footer>
      {pmsSlug && <BookingDialog tenantSlug={pmsSlug} open={bookingOpen} onClose={() => setBookingOpen(false)} />}
    </div>
  );
}

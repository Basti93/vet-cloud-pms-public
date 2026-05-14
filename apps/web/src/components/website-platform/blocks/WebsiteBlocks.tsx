'use client';

/* eslint-disable @next/next/no-img-element */

import { useState } from 'react';
import { Calendar, Clock, Mail, MapPin, Phone } from 'lucide-react';
import type { WebsiteCapabilityConfig, WebsitePageBlock } from '@/lib/website-platform/types';
import { getBookingUrl } from '@/lib/website-platform/capabilities';
import { resolveAssetUrl } from '@/lib/website-platform/assets';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface BlockProps<T extends WebsitePageBlock = WebsitePageBlock> {
  block: T;
  capabilities: WebsiteCapabilityConfig;
  assetMap?: Record<string, string>;
  projectId: string;
  pagePath: string;
  tenantHoursRows?: { days: string; time: string }[] | null;
  tenantContactInfo?: { address?: string | null; phone?: string | null; email?: string | null; city?: string | null } | null;
}

const sectionInner = 'mx-auto max-w-6xl px-4 sm:px-6 lg:px-8';

function SectionHeading({ icon, title, subtitle }: { icon?: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="mb-12 flex flex-col items-center text-center">
      {icon && <div className="mb-3" style={{ color: 'var(--color-accent)' }}>{icon}</div>}
      <h2
        className="text-3xl font-bold sm:text-4xl"
        style={{ fontFamily: 'var(--font-heading)', fontWeight: 'var(--font-heading-weight)', letterSpacing: 'var(--font-heading-tracking)', color: 'var(--color-fg)' }}
      >
        {title}
      </h2>
      {subtitle && <p className="mt-3 max-w-xl text-base" style={{ color: 'var(--color-muted)' }}>{subtitle}</p>}
    </div>
  );
}

function BookingDialog({ tenantSlug, open, onClose }: { tenantSlug: string; open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent
        className="max-w-2xl"
        style={{ height: '90vh', padding: 0, display: 'flex', flexDirection: 'column', gap: 0, overflow: 'hidden' }}
      >
        <DialogHeader className="flex-shrink-0 px-4 py-3 border-b border-[var(--color-border)]">
          <DialogTitle>Termin buchen</DialogTitle>
        </DialogHeader>
        <iframe
          src={`/book/${tenantSlug}`}
          style={{ flex: 1, width: '100%', border: 0, minHeight: 0 }}
          title="Termin buchen"
        />
      </DialogContent>
    </Dialog>
  );
}

// ─── Hero ──────────────────────────────────────────────────────────────────────

export function HeroBlock({ block, capabilities, assetMap }: BlockProps<Extract<WebsitePageBlock, { type: 'hero' }>>) {
  const [bookingOpen, setBookingOpen] = useState(false);
  const imageUrl = resolveAssetUrl(block.props.image, assetMap);
  const bookingUrl = getBookingUrl(capabilities);
  const pmsSlug = capabilities.booking.enabled && capabilities.booking.mode === 'pms' ? capabilities.booking.tenantSlug : null;
  const hasImage = Boolean(imageUrl);

  return (
    <section
      id="start"
      className="relative flex items-center overflow-hidden"
      style={{ minHeight: '82vh' }}
    >
      {/* Background image */}
      {hasImage && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${imageUrl})` }}
        />
      )}
      {/* Gradient overlay — accent color when image present, soft bg when not */}
      {hasImage ? (
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 88%, black) 0%, rgba(0,0,0,0.52) 100%)' }}
        />
      ) : (
        <div className="absolute inset-0" style={{ background: 'var(--color-accent-soft)' }} />
      )}

      <div className={`${sectionInner} relative z-10 py-20 w-full`}>
        <div className="max-w-2xl">
          {block.props.eyebrow && (
            <div className="mb-4 flex items-center gap-2">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20"
                style={{ color: hasImage ? '#ffd180' : 'var(--color-accent)' }}>
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
              </svg>
              <span
                className="text-sm font-bold uppercase tracking-widest"
                style={{ color: hasImage ? '#ffd180' : 'var(--color-accent-text)' }}
              >
                {block.props.eyebrow}
              </span>
            </div>
          )}

          <h1
            className="text-4xl font-bold leading-tight sm:text-5xl"
            style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 'var(--font-heading-weight)',
              color: hasImage ? 'white' : 'var(--color-fg)',
              textShadow: hasImage ? '0 2px 20px rgba(0,0,0,0.3)' : 'none',
            }}
          >
            {block.props.title}
          </h1>

          {block.props.subtitle && (
            <p
              className="mt-5 max-w-xl text-lg leading-relaxed"
              style={{ color: hasImage ? 'rgba(255,255,255,0.9)' : 'var(--color-muted)' }}
            >
              {block.props.subtitle}
            </p>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            {bookingUrl && (
              pmsSlug
                ? (
                  <button
                    onClick={() => setBookingOpen(true)}
                    className="rounded-full px-6 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
                    style={{ background: 'var(--color-secondary, var(--color-accent))' }}
                  >
                    {block.props.primaryCtaLabel}
                  </button>
                )
                : (
                  <a
                    href={bookingUrl}
                    className="rounded-full px-6 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
                    style={{ background: 'var(--color-secondary, var(--color-accent))' }}
                  >
                    {block.props.primaryCtaLabel}
                  </a>
                )
            )}
            <a
              href="#kontakt"
              className="rounded-full px-6 py-3 text-sm font-semibold transition-colors"
              style={hasImage
                ? { border: '1px solid rgba(255,255,255,0.5)', color: 'white', background: 'rgba(255,255,255,0.08)' }
                : { border: '1px solid var(--color-border-strong)', color: 'var(--color-fg)', background: 'white' }}
            >
              {block.props.secondaryCtaLabel}
            </a>
          </div>
        </div>
      </div>

      {pmsSlug && <BookingDialog tenantSlug={pmsSlug} open={bookingOpen} onClose={() => setBookingOpen(false)} />}
    </section>
  );
}

// ─── Rich Text ─────────────────────────────────────────────────────────────────

export function RichTextBlock({ block }: BlockProps<Extract<WebsitePageBlock, { type: 'richText' }>>) {
  return (
    <section className="py-[var(--spacing-section,4rem)]">
      <div className={sectionInner}>
        {block.props.heading && (
          <h2
            className="mb-5 text-3xl font-bold"
            style={{ fontFamily: 'var(--font-heading)', fontWeight: 'var(--font-heading-weight)' }}
          >
            {block.props.heading}
          </h2>
        )}
        <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: block.props.html }} />
      </div>
    </section>
  );
}

// ─── Services Grid ─────────────────────────────────────────────────────────────

const SERVICE_ICONS: Record<string, React.ReactNode> = {
  heart: (
    <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
    </svg>
  ),
  syringe: (
    <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5-4.72-4.72a.75.75 0 0 0-1.28.53v.69H8.25a.75.75 0 0 0-.75.75v3h-.69a.75.75 0 0 0-.53 1.28l4.72 4.72M15.75 10.5H17a2.25 2.25 0 0 1 2.25 2.25v.75a2.25 2.25 0 0 1-2.25 2.25H13.5m2.25-5.25L12 14.25m3.75-3.75L12 14.25m0 0-2.47 2.47M9 12l-2.47 2.47m0 0L5.25 15.75" />
    </svg>
  ),
  vaccination: (
    <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  ),
  microscope: (
    <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 1-6.23-.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
    </svg>
  ),
  scissors: (
    <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="m7.848 8.25 1.536.887M7.848 8.25a3 3 0 1 1-5.196-3 3 3 0 0 1 5.196 3Zm1.536.887a2.165 2.165 0 0 1 1.083 1.839c.005.351.054.695.14 1.024M9.384 9.137l2.077 4.011m0 0 1.785 3.445a3 3 0 0 0 5.196-3L13.461 13.148Zm0 0-2.077-4.011m0 0a3 3 0 0 0-4.419-2.891M13.461 13.148l-1.536-.887m0 0a3 3 0 1 1-5.196 3 3 3 0 0 1 5.196-3Z" />
    </svg>
  ),
  tooth: (
    <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 0 1-6.364 0M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Z" />
    </svg>
  ),
  emergency: (
    <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>
  ),
  xray: (
    <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z" />
    </svg>
  ),
  paw: (
    <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2C9.243 2 7 4.243 7 7s2.243 5 5 5 5-2.243 5-5-2.243-5-5-5zM5.5 9C4.122 9 3 10.122 3 11.5S4.122 14 5.5 14 8 12.878 8 11.5 6.878 9 5.5 9zm13 0C17.122 9 16 10.122 16 11.5S17.122 14 18.5 14 21 12.878 21 11.5 19.878 9 18.5 9zm-7 7c-3.866 0-7 1.79-7 4v1h14v-1c0-2.21-3.134-4-7-4z"/>
    </svg>
  ),
  bone: (
    <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75 2.25 12l4.179 2.25m0-4.5 5.571 3 5.571-3m-11.142 0L2.25 7.5 6.429 5.25m0 4.5-4.179 2.25m0 0L2.25 16.5 6.429 18.75m4.5-6.75 5.571-3 5.571 3M10.929 12l5.571 3m0 0 4.179-2.25M16.5 15l4.179 2.25-4.179 2.25M6.429 18.75l5.571-3 5.571 3" />
    </svg>
  ),
  eye: (
    <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  ),
  surgery: (
    <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M5 14.5l-.781.22A2.25 2.25 0 0 0 2.25 16.9v.1a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 17v-.1a2.25 2.25 0 0 0-1.97-2.18L19.8 15.3M5 14.5h14.8" />
    </svg>
  ),
  wellness: (
    <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
    </svg>
  ),
  default: (
    <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
    </svg>
  ),
};

function getServiceIcon(iconKey?: string): React.ReactNode {
  return SERVICE_ICONS[iconKey ?? ''] ?? SERVICE_ICONS.default;
}

export function ServicesGridBlock({ block }: BlockProps<Extract<WebsitePageBlock, { type: 'servicesGrid' }>>) {
  return (
    <section id="leistungen" className="py-[var(--spacing-section,4rem)]" style={{ background: 'white' }}>
      <div className={sectionInner}>
        <SectionHeading title={block.props.heading} subtitle={block.props.intro} />
        {/* Single shared style for hover effects using CSS vars */}
        <style>{`
          .service-card:hover { border-color: var(--color-accent) !important; }
          .service-card:hover .service-icon { background: var(--color-accent) !important; color: white !important; }
        `}</style>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {block.props.services.map((service) => (
            <article
              key={service.id}
              className="service-card rounded-[var(--radius-base,1rem)] border p-6 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
              style={{ borderColor: 'var(--color-border)', background: 'white' }}
            >
              <div
                className="service-icon mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full transition-colors duration-300"
                style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent-text)' }}
              >
                {getServiceIcon(service.iconKey)}
              </div>
              <h3 className="font-semibold" style={{ color: 'var(--color-fg)' }}>{service.title}</h3>
              <p className="mt-2 text-sm" style={{ color: 'var(--color-muted)' }}>{service.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Team List ─────────────────────────────────────────────────────────────────

export function TeamListBlock({ block, assetMap }: BlockProps<Extract<WebsitePageBlock, { type: 'teamList' }>>) {
  return (
    <section id="team" className="py-[var(--spacing-section,4rem)]" style={{ background: 'var(--color-bg)' }}>
      <div className={sectionInner}>
        <SectionHeading title={block.props.heading} subtitle={block.props.intro} />
        <div className="mx-auto grid max-w-3xl gap-8 md:grid-cols-2">
          {block.props.people.map((person) => {
            const image = resolveAssetUrl(person.image, assetMap);
            return (
              <article
                key={person.id}
                className="flex flex-col items-center rounded-[var(--radius-base,1rem)] p-8 text-center shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                style={{ background: 'white' }}
              >
                {image ? (
                  <img
                    src={image}
                    alt={person.image?.altOverride ?? person.name}
                    className="mb-5 h-44 w-44 rounded-full object-cover"
                    style={{ border: '4px solid var(--color-accent)' }}
                  />
                ) : (
                  <div
                    className="mb-5 flex h-44 w-44 items-center justify-center rounded-full text-4xl font-bold text-white"
                    style={{ background: 'var(--color-accent)' }}
                  >
                    {person.name.charAt(0)}
                  </div>
                )}

                <h3
                  className="text-xl font-bold"
                  style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-fg)' }}
                >
                  {person.name}
                </h3>

                {person.title && (
                  <span
                    className="mt-2 rounded-full border px-3 py-0.5 text-xs font-medium"
                    style={{ borderColor: 'var(--color-accent)', color: 'var(--color-accent-text)' }}
                  >
                    {person.title}
                  </span>
                )}

                {person.bio && (
                  <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--color-muted)' }}>
                    {person.bio}
                  </p>
                )}

                {person.focus.length > 0 && (
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {person.focus.map((f) => (
                      <span
                        key={f}
                        className="rounded-full px-3 py-1 text-xs font-semibold text-white"
                        style={{ background: 'var(--color-accent)' }}
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── Hours Table ───────────────────────────────────────────────────────────────

export function HoursTableBlock({ block, tenantHoursRows }: BlockProps<Extract<WebsitePageBlock, { type: 'hoursTable' }>>) {
  const effectiveSections = !block.props.useManualOverride && tenantHoursRows
    ? [{ id: 'tenant', title: 'Sprechzeiten', chipLabel: undefined, chipColor: undefined, rows: tenantHoursRows, note: undefined }]
    : block.props.sections;

  return (
    <section
      id="sprechzeiten"
      className="relative overflow-hidden py-[var(--spacing-section,4rem)]"
      style={{ background: 'var(--color-accent)', color: 'white' }}
    >
      {/* Decorative circle */}
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full opacity-5"
        style={{ background: 'white' }}
      />

      <div className={sectionInner}>
        <div className="mb-12 text-center">
          <Clock className="mx-auto mb-3 h-10 w-10 opacity-80" />
          <h2
            className="text-3xl font-bold text-white sm:text-4xl"
            style={{ fontFamily: 'var(--font-heading)', fontWeight: 'var(--font-heading-weight)' }}
          >
            {block.props.heading}
          </h2>
        </div>

        <div className={`grid gap-5 ${effectiveSections.length === 1 ? 'max-w-sm mx-auto' : effectiveSections.length === 2 ? 'md:grid-cols-2 max-w-2xl mx-auto' : 'md:grid-cols-3'}`}>
          {effectiveSections.map((item) => (
            <article
              key={item.id}
              className="rounded-[var(--radius-base,1rem)] p-6"
              style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}
            >
              <Clock className="mb-3 h-8 w-8" style={{ color: 'rgba(255,255,255,0.7)' }} />
              <h3 className="text-lg font-bold text-white">{item.title}</h3>
              {item.chipLabel && (
                <span
                  className="mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                  style={{ background: item.chipColor ?? 'rgba(255,255,255,0.2)' }}
                >
                  {item.chipLabel}
                </span>
              )}
              <div className="mt-4 space-y-2">
                {item.rows.map((row) => (
                  <div
                    key={`${row.days}-${row.time}`}
                    className="flex justify-between border-t py-2 text-sm"
                    style={{ borderColor: 'rgba(255,255,255,0.2)' }}
                  >
                    <span className="font-semibold text-white">{row.days}</span>
                    <span style={{ color: 'rgba(255,255,255,0.85)' }}>{row.time}</span>
                  </div>
                ))}
              </div>
              {item.note && (
                <p className="mt-3 text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>{item.note}</p>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Contact Card ──────────────────────────────────────────────────────────────

export function ContactCardBlock({ block, capabilities, tenantContactInfo }: BlockProps<Extract<WebsitePageBlock, { type: 'contactCard' }>>) {
  const [bookingOpen, setBookingOpen] = useState(false);
  const address = !block.props.useManualOverride && tenantContactInfo
    ? [tenantContactInfo.address, tenantContactInfo.city].filter(Boolean).join('\n') || undefined
    : block.props.address;
  const phone = !block.props.useManualOverride && tenantContactInfo ? tenantContactInfo.phone ?? undefined : block.props.phone;
  const email = !block.props.useManualOverride && tenantContactInfo ? tenantContactInfo.email ?? undefined : block.props.email;
  const embedUrl = block.props.embedUrl;
  const bookingUrl = getBookingUrl(capabilities);
  const pmsSlug = capabilities.booking.enabled && capabilities.booking.mode === 'pms' ? capabilities.booking.tenantSlug : null;

  const hasMap = Boolean(embedUrl);

  return (
    <section id="kontakt" className="py-[var(--spacing-section,4rem)]" style={{ background: 'var(--color-bg)' }}>
      <div className={sectionInner}>
        <SectionHeading
          icon={<MapPin className="h-10 w-10" />}
          title={block.props.heading}
          subtitle={block.props.description}
        />

        <div className={`grid gap-6 ${hasMap ? 'md:grid-cols-7' : ''}`}>
          {/* Map */}
          {hasMap && (
            <div className="overflow-hidden rounded-[var(--radius-base,1rem)] shadow-md md:col-span-4" style={{ height: 400 }}>
              <iframe src={embedUrl} className="h-full w-full border-0" loading="lazy" title="Standort" />
            </div>
          )}

          {/* Contact info */}
          <div className={`flex flex-col gap-4 ${hasMap ? 'md:col-span-3' : ''}`}>
            {address && (
              <div
                className="flex gap-4 rounded-[var(--radius-base,1rem)] p-5 shadow-sm"
                style={{ background: 'white', border: '1px solid var(--color-border)' }}
              >
                <div
                  className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full"
                  style={{ background: 'var(--color-accent)' }}
                >
                  <MapPin className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold" style={{ color: 'var(--color-fg)' }}>Adresse</p>
                  <p className="mt-1 whitespace-pre-line text-sm" style={{ color: 'var(--color-muted)' }}>{address}</p>
                </div>
              </div>
            )}

            {phone && (
              <div
                className="flex gap-4 rounded-[var(--radius-base,1rem)] p-5 shadow-sm"
                style={{ background: 'white', border: '1px solid var(--color-border)' }}
              >
                <div
                  className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full"
                  style={{ background: 'var(--color-accent)' }}
                >
                  <Phone className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold" style={{ color: 'var(--color-fg)' }}>Telefon</p>
                  <a
                    href={`tel:${phone.replace(/[\s/]/g, '')}`}
                    className="mt-1 text-lg font-bold transition-opacity hover:opacity-80"
                    style={{ color: 'var(--color-accent)' }}
                  >
                    {phone}
                  </a>
                </div>
              </div>
            )}

            {email && (
              <div
                className="flex gap-4 rounded-[var(--radius-base,1rem)] p-5 shadow-sm"
                style={{ background: 'white', border: '1px solid var(--color-border)' }}
              >
                <div
                  className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full"
                  style={{ background: 'var(--color-accent)' }}
                >
                  <Mail className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold" style={{ color: 'var(--color-fg)' }}>E-Mail</p>
                  <a
                    href={`mailto:${email}`}
                    className="mt-1 text-sm transition-opacity hover:opacity-80"
                    style={{ color: 'var(--color-accent)' }}
                  >
                    {email}
                  </a>
                </div>
              </div>
            )}

            {bookingUrl && (
              <div>
                {pmsSlug ? (
                  <button
                    onClick={() => setBookingOpen(true)}
                    className="w-full rounded-full py-4 text-center font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ background: 'var(--color-accent)' }}
                  >
                    Termin buchen
                  </button>
                ) : (
                  <a
                    href={bookingUrl}
                    className="block w-full rounded-full py-4 text-center font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ background: 'var(--color-accent)' }}
                  >
                    Termin buchen
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {pmsSlug && <BookingDialog tenantSlug={pmsSlug} open={bookingOpen} onClose={() => setBookingOpen(false)} />}
    </section>
  );
}

// ─── Contact Form ──────────────────────────────────────────────────────────────

export function ContactFormBlock({ block, projectId, pagePath }: BlockProps<Extract<WebsitePageBlock, { type: 'contactForm' }>>) {
  return (
    <section className="py-[var(--spacing-section,4rem)]" style={{ background: 'white' }}>
      <div className={sectionInner}>
        <SectionHeading
          icon={<Mail className="h-10 w-10" />}
          title={block.props.heading}
        />
        <form
          action="/api/website-leads"
          method="post"
          className="mx-auto max-w-xl rounded-[var(--radius-base,1rem)] p-6 shadow-sm"
          style={{ border: '1px solid var(--color-border)', background: 'white' }}
        >
          <input type="hidden" name="websiteProjectId" value={projectId} />
          <input type="hidden" name="sourcePagePath" value={pagePath} />
          <div className="grid gap-3">
            <input
              name="name"
              required
              placeholder="Name"
              className="w-full rounded-xl px-4 py-3 text-sm outline-none focus:ring-2"
              style={{ border: '1px solid var(--color-border)', background: 'white' }}
            />
            <input
              name="email"
              type="email"
              required
              placeholder="E-Mail"
              className="w-full rounded-xl px-4 py-3 text-sm outline-none focus:ring-2"
              style={{ border: '1px solid var(--color-border)', background: 'white' }}
            />
            <input
              name="phone"
              placeholder="Telefon (optional)"
              className="w-full rounded-xl px-4 py-3 text-sm outline-none focus:ring-2"
              style={{ border: '1px solid var(--color-border)', background: 'white' }}
            />
            <textarea
              name="message"
              required
              placeholder="Nachricht"
              rows={5}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 resize-none"
              style={{ border: '1px solid var(--color-border)', background: 'white' }}
            />
            <label className="flex items-start gap-2 text-xs" style={{ color: 'var(--color-muted)' }}>
              <input type="checkbox" name="consent" value="true" required className="mt-0.5 flex-shrink-0" />
              {block.props.consentLabel}
            </label>
            <button
              type="submit"
              className="self-start rounded-full px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--color-accent)' }}
            >
              Absenden
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

// ─── Booking CTA ───────────────────────────────────────────────────────────────

export function BookingCtaBlock({ block, capabilities }: BlockProps<Extract<WebsitePageBlock, { type: 'bookingCta' }>>) {
  const [bookingOpen, setBookingOpen] = useState(false);
  const bookingUrl = getBookingUrl(capabilities);
  const pmsSlug = capabilities.booking.enabled && capabilities.booking.mode === 'pms' ? capabilities.booking.tenantSlug : null;
  if (!bookingUrl) return null;

  return (
    <section className="py-[var(--spacing-section,4rem)]">
      <div className={sectionInner}>
        <div
          className="rounded-[var(--radius-base,1rem)] p-10 text-white shadow-lg"
          style={{ background: 'var(--color-accent)' }}
        >
          <Calendar className="mb-4 h-10 w-10 opacity-90" />
          <h2
            className="text-3xl font-bold"
            style={{ fontFamily: 'var(--font-heading)', fontWeight: 'var(--font-heading-weight)' }}
          >
            {block.props.heading}
          </h2>
          {block.props.text && (
            <p className="mt-3 max-w-xl text-base opacity-90">{block.props.text}</p>
          )}
          {pmsSlug ? (
            <button
              onClick={() => setBookingOpen(true)}
              className="mt-6 inline-flex rounded-full bg-white px-7 py-3 font-semibold transition-opacity hover:opacity-90"
              style={{ color: 'var(--color-accent-text)' }}
            >
              {block.props.buttonLabel}
            </button>
          ) : (
            <a
              href={bookingUrl}
              className="mt-6 inline-flex rounded-full bg-white px-7 py-3 font-semibold transition-opacity hover:opacity-90"
              style={{ color: 'var(--color-accent-text)' }}
            >
              {block.props.buttonLabel}
            </a>
          )}
        </div>
      </div>
      {pmsSlug && <BookingDialog tenantSlug={pmsSlug} open={bookingOpen} onClose={() => setBookingOpen(false)} />}
    </section>
  );
}

// ─── Map Embed ─────────────────────────────────────────────────────────────────

export function MapEmbedBlock({ block, tenantContactInfo }: BlockProps<Extract<WebsitePageBlock, { type: 'mapEmbed' }>>) {
  const address = !block.props.useManualOverride && tenantContactInfo
    ? [tenantContactInfo.address, tenantContactInfo.city].filter(Boolean).join(', ') || undefined
    : block.props.address;

  const embedSrc = block.props.embedUrl || (address ? `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed` : null);

  return (
    <section className="py-[var(--spacing-section,4rem)]">
      <div className={sectionInner}>
        {block.props.heading && (
          <h2
            className="mb-5 text-3xl font-bold"
            style={{ fontFamily: 'var(--font-heading)', fontWeight: 'var(--font-heading-weight)' }}
          >
            {block.props.heading}
          </h2>
        )}
        {embedSrc && (
          <iframe
            src={embedSrc}
            className="h-80 w-full border-0 shadow-sm"
            style={{ borderRadius: 'var(--radius-base, 1rem)' }}
            loading="lazy"
            title="Standort"
          />
        )}
      </div>
    </section>
  );
}

// ─── Legal Text ────────────────────────────────────────────────────────────────

export function LegalTextBlock({ block }: BlockProps<Extract<WebsitePageBlock, { type: 'legalText' }>>) {
  return (
    <section className="py-[var(--spacing-section,4rem)]">
      <div className={sectionInner}>
        <h1
          className="text-3xl font-bold"
          style={{ fontFamily: 'var(--font-heading)', fontWeight: 'var(--font-heading-weight)' }}
        >
          {block.props.heading}
        </h1>
        <div className="prose mt-6 max-w-none" dangerouslySetInnerHTML={{ __html: block.props.html }} />
      </div>
    </section>
  );
}

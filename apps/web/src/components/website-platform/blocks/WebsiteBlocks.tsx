'use client';

/* eslint-disable @next/next/no-img-element */

import { useState, useEffect } from 'react';
import * as LucideIcons from 'lucide-react';
import { Calendar, Clock, Mail, MapPin, PawPrint, Phone } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { WebsiteCapabilityConfig, WebsitePageBlock } from '@/lib/website-platform/types';
import { getBookingUrl } from '@/lib/website-platform/capabilities';
import { resolveAssetUrl } from '@/lib/website-platform/assets';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { interpolate, type TemplateVars } from '@/lib/website-platform/template';

interface BlockProps<T extends WebsitePageBlock = WebsitePageBlock> {
  block: T;
  capabilities: WebsiteCapabilityConfig;
  assetMap?: Record<string, string>;
  projectId: string;
  pagePath: string;
  templateVars?: TemplateVars;
  previewToken?: string;
  tenantHoursRows?: { days: string; time: string }[] | null;
  tenantConsultationHoursRows?: { days: string; time: string }[] | null;
  tenantOpeningHoursRows?: { days: string; time: string }[] | null;
  tenantSpecialHours?: Array<{ id: string; title: string; startsOn?: string; endsOn?: string; rows: { days: string; time: string }[]; note?: string }> | null;
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

export function BookingDialog({ tenantSlug, open, onClose, previewToken }: { tenantSlug: string; open: boolean; onClose: () => void; previewToken?: string }) {
  const src = previewToken ? `/book/${tenantSlug}?preview=${previewToken}` : `/book/${tenantSlug}`;
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
          src={src}
          style={{ flex: 1, width: '100%', border: 0, minHeight: 0 }}
          title="Termin buchen"
        />
      </DialogContent>
    </Dialog>
  );
}

// ─── Hero ──────────────────────────────────────────────────────────────────────

export function HeroBlock({ block, capabilities, assetMap, templateVars = {}, previewToken }: BlockProps<Extract<WebsitePageBlock, { type: 'hero' }>>) {
  const [bookingOpen, setBookingOpen] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);

  // Build ordered image list: new `images` array first, fall back to legacy `image`
  const slideAssets = block.props.images?.length
    ? block.props.images
    : block.props.image ? [block.props.image] : [];
  const slideUrls = slideAssets.map((ref) => resolveAssetUrl(ref, assetMap)).filter(Boolean) as string[];

  const intervalMs = (block.props.slideshowInterval ?? 5) * 1000;
  useEffect(() => {
    if (slideUrls.length <= 1) return;
    const id = setInterval(() => setSlideIndex((i) => (i + 1) % slideUrls.length), intervalMs);
    return () => clearInterval(id);
  }, [slideUrls.length, intervalMs]);

  const bookingUrl = getBookingUrl(capabilities);
  const pmsSlug = capabilities.booking.enabled && capabilities.booking.mode === 'pms' ? capabilities.booking.tenantSlug : null;
  const hasImage = slideUrls.length > 0;
  const t = (s?: string | null) => interpolate(s, templateVars);

  return (
    <section
      id="start"
      className="relative flex items-center overflow-hidden"
      style={{ minHeight: '82vh' }}
    >
      {/* Slideshow background images — cross-fade via opacity */}
      {slideUrls.map((url, i) => (
        <div
          key={url}
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${url})`, opacity: i === slideIndex ? 1 : 0, transition: 'opacity 1.8s cubic-bezier(0.4, 0, 0.2, 1)', willChange: 'opacity' }}
        />
      ))}
      {!hasImage && <div className="absolute inset-0" style={{ background: 'var(--color-accent-soft)' }} />}
      {/* Gradient overlay */}
      {hasImage && (
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 88%, black) 0%, rgba(0,0,0,0.52) 100%)' }}
        />
      )}
      {/* Slide indicator dots */}
      {slideUrls.length > 1 && (
        <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 gap-2">
          {slideUrls.map((_, i) => (
            <button
              key={i}
              onClick={() => setSlideIndex(i)}
              className="h-2 cursor-pointer rounded-full transition-all duration-300"
              style={{
                width: i === slideIndex ? '1.5rem' : '0.5rem',
                background: i === slideIndex ? 'white' : 'rgba(255,255,255,0.45)',
              }}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      )}

      <div className={`${sectionInner} relative z-10 py-20 w-full`}>
        <div className="max-w-2xl">
          {block.props.eyebrow && (
            <div className="mb-4 flex items-center gap-2">
              <PawPrint className="h-5 w-5" fill="currentColor" stroke="none"
                style={{ color: hasImage ? '#ffd180' : 'var(--color-accent)' }} />
              <span
                className="text-sm font-bold uppercase tracking-widest"
                style={{ color: hasImage ? '#ffd180' : 'var(--color-accent-text)' }}
              >
                {t(block.props.eyebrow)}
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
            {t(block.props.title)}
          </h1>

          {block.props.subtitle && (
            <p
              className="mt-5 max-w-xl text-lg leading-relaxed"
              style={{ color: hasImage ? 'rgba(255,255,255,0.9)' : 'var(--color-muted)' }}
            >
              {t(block.props.subtitle)}
            </p>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            {bookingUrl && (
              pmsSlug
                ? (
                  <button
                    onClick={() => setBookingOpen(true)}
                    className="cursor-pointer rounded-full px-6 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
                    style={{ background: 'var(--color-secondary, var(--color-accent))' }}
                  >
                    {t(block.props.primaryCtaLabel)}
                  </button>
                )
                : (
                  <a
                    href={bookingUrl}
                    className="cursor-pointer rounded-full px-6 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
                    style={{ background: 'var(--color-secondary, var(--color-accent))' }}
                  >
                    {t(block.props.primaryCtaLabel)}
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
              {t(block.props.secondaryCtaLabel)}
            </a>
          </div>
        </div>
      </div>

      {pmsSlug && <BookingDialog tenantSlug={pmsSlug} open={bookingOpen} onClose={() => setBookingOpen(false)} previewToken={previewToken} />}
    </section>
  );
}

// ─── Rich Text ─────────────────────────────────────────────────────────────────

export function RichTextBlock({ block, templateVars = {} }: BlockProps<Extract<WebsitePageBlock, { type: 'richText' }>>) {
  const t = (s?: string | null) => interpolate(s, templateVars);
  return (
    <section className="py-[var(--spacing-section,4rem)]">
      <div className={sectionInner}>
        {block.props.heading && (
          <h2
            className="mb-5 text-3xl font-bold"
            style={{ fontFamily: 'var(--font-heading)', fontWeight: 'var(--font-heading-weight)' }}
          >
            {t(block.props.heading)}
          </h2>
        )}
        <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: block.props.html }} />
      </div>
    </section>
  );
}

// ─── Services Grid ─────────────────────────────────────────────────────────────

export const SERVICE_ICON_KEYS = Object.entries(LucideIcons)
  .filter(([name, value]) => /^[A-Z]/.test(name) && !name.endsWith('Icon') && typeof value === 'object' && value !== null && '$$typeof' in value)
  .map(([name]) => name)
  .sort();

const SERVICE_ICONS = LucideIcons as unknown as Record<string, LucideIcon | undefined>;

const LEGACY_SERVICE_ICON_KEYS: Record<string, string> = {
  heart: 'Heart',
  syringe: 'Syringe',
  vaccination: 'ShieldCheck',
  microscope: 'Microscope',
  scissors: 'Scissors',
  tooth: 'BadgeCheck',
  emergency: 'TriangleAlert',
  xray: 'ScanSearch',
  paw: 'PawPrint',
  bone: 'Bone',
  eye: 'Eye',
  surgery: 'FlaskConical',
  wellness: 'Sparkles',
};

function resolveServiceIconKey(iconKey?: string): string {
  if (iconKey && SERVICE_ICONS[iconKey]) return iconKey;
  if (iconKey && LEGACY_SERVICE_ICON_KEYS[iconKey]) return LEGACY_SERVICE_ICON_KEYS[iconKey];
  return 'Heart';
}

export function getServiceIcon(iconKey?: string): React.ReactNode {
  const Icon = (SERVICE_ICONS[resolveServiceIconKey(iconKey)] ?? LucideIcons.Heart) as LucideIcon;
  return <Icon className="h-8 w-8" strokeWidth={1.5} />;
}

export function ServicesGridBlock({ block, templateVars = {} }: BlockProps<Extract<WebsitePageBlock, { type: 'servicesGrid' }>>) {
  const t = (s?: string | null) => interpolate(s, templateVars);
  return (
    <section id="leistungen" className="py-[var(--spacing-section,4rem)]" style={{ background: 'white' }}>
      <div className={sectionInner}>
        <SectionHeading title={t(block.props.heading)} subtitle={t(block.props.intro)} />
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
              <h3 className="font-semibold" style={{ color: 'var(--color-fg)' }}>{t(service.title)}</h3>
              <p className="mt-2 text-sm" style={{ color: 'var(--color-muted)' }}>{t(service.description)}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Team List ─────────────────────────────────────────────────────────────────

export function TeamListBlock({ block, assetMap, templateVars = {} }: BlockProps<Extract<WebsitePageBlock, { type: 'teamList' }>>) {
  const t = (s?: string | null) => interpolate(s, templateVars);
  return (
    <section id="team" className="py-[var(--spacing-section,4rem)]" style={{ background: 'var(--color-bg)' }}>
      <div className={sectionInner}>
        <SectionHeading icon={<PawPrint className="h-10 w-10" fill="currentColor" stroke="none" />} title={t(block.props.heading)} subtitle={t(block.props.intro)} />
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
                  {t(person.name)}
                </h3>

                {person.title && (
                  <span
                    className="mt-2 rounded-full border px-3 py-0.5 text-xs font-medium"
                    style={{ borderColor: 'var(--color-accent)', color: 'var(--color-accent-text)' }}
                  >
                    {t(person.title)}
                  </span>
                )}

                {person.bio && (
                  <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--color-muted)' }}>
                    {t(person.bio)}
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

export function HoursTableBlock({ block, tenantHoursRows, tenantConsultationHoursRows, tenantOpeningHoursRows }: BlockProps<Extract<WebsitePageBlock, { type: 'hoursTable' }>>) {
  const tenantSections = [
    ...(tenantConsultationHoursRows?.length
      ? [{
          id: 'consultation',
          title: block.props.consultationTitle,
          chipLabel: block.props.consultationChipLabel,
          chipColor: undefined,
          rows: tenantConsultationHoursRows,
          note: block.props.consultationNote,
        }]
      : []),
    ...(tenantOpeningHoursRows?.length
      ? [{
          id: 'opening',
          title: block.props.openingTitle,
          chipLabel: block.props.openingChipLabel,
          chipColor: undefined,
          rows: tenantOpeningHoursRows,
          note: block.props.openingNote,
        }]
      : []),
  ];
  const fallbackTenantSections = tenantHoursRows
    ? [{ id: 'tenant', title: block.props.consultationTitle, chipLabel: block.props.consultationChipLabel, chipColor: undefined, rows: tenantHoursRows, note: block.props.consultationNote }]
    : [];
  const effectiveSections = !block.props.useManualOverride
    ? (tenantSections.length > 0 ? tenantSections : fallbackTenantSections)
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

// ─── Special Hours ────────────────────────────────────────────────────────────

function formatDateRange(startsOn?: string, endsOn?: string) {
  if (!startsOn && !endsOn) return null;
  const format = (value: string) => {
    const [year, month, day] = value.split('-');
    return day && month && year ? `${day}.${month}.${year}` : value;
  };
  if (startsOn && endsOn) return `${format(startsOn)} – ${format(endsOn)}`;
  return startsOn ? `ab ${format(startsOn)}` : `bis ${format(endsOn!)}`;
}

export function SpecialHoursBlock({ block, tenantSpecialHours }: BlockProps<Extract<WebsitePageBlock, { type: 'specialHours' }>>) {
  const entries = tenantSpecialHours ?? [];

  return (
    <section id="urlaubszeiten" className="py-[var(--spacing-section,4rem)]" style={{ background: 'white' }}>
      <div className={sectionInner}>
        <SectionHeading
          icon={<Calendar className="h-10 w-10" />}
          title={block.props.heading}
          subtitle={block.props.note}
        />

        {entries.length === 0 ? (
          <p className="mx-auto max-w-xl rounded-[var(--radius-base,1rem)] border px-5 py-4 text-center text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)', background: 'var(--color-bg)' }}>
            {block.props.emptyText}
          </p>
        ) : (
          <div className="mx-auto grid max-w-3xl gap-5">
            {entries.map((entry) => {
              const dateRange = formatDateRange(entry.startsOn, entry.endsOn);
              return (
                <article
                  key={entry.id}
                  className="rounded-[var(--radius-base,1rem)] p-6 shadow-sm"
                  style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold" style={{ color: 'var(--color-fg)' }}>{entry.title}</h3>
                      {dateRange && (
                        <span className="mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium text-white" style={{ background: 'var(--color-accent)' }}>
                          {dateRange}
                        </span>
                      )}
                    </div>
                    <Clock className="h-7 w-7" style={{ color: 'var(--color-accent)' }} />
                  </div>
                  <div className="mt-4 space-y-2">
                    {entry.rows.map((row) => (
                      <div key={`${entry.id}-${row.days}-${row.time}`} className="flex justify-between border-t py-2 text-sm" style={{ borderColor: 'var(--color-border)' }}>
                        <span className="font-semibold" style={{ color: 'var(--color-fg)' }}>{row.days}</span>
                        <span style={{ color: 'var(--color-muted)' }}>{row.time}</span>
                      </div>
                    ))}
                  </div>
                  {entry.note && <p className="mt-3 text-xs" style={{ color: 'var(--color-muted)' }}>{entry.note}</p>}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Contact Card ──────────────────────────────────────────────────────────────

export function ContactCardBlock({ block, capabilities, tenantContactInfo, previewToken }: BlockProps<Extract<WebsitePageBlock, { type: 'contactCard' }>>) {
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
                    className="w-full cursor-pointer rounded-full py-4 text-center font-semibold text-white transition-opacity hover:opacity-90"
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
      {pmsSlug && <BookingDialog tenantSlug={pmsSlug} open={bookingOpen} onClose={() => setBookingOpen(false)} previewToken={previewToken} />}
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

export function BookingCtaBlock({ block, capabilities, templateVars = {}, previewToken }: BlockProps<Extract<WebsitePageBlock, { type: 'bookingCta' }>>) {
  const [bookingOpen, setBookingOpen] = useState(false);
  const bookingUrl = getBookingUrl(capabilities);
  const pmsSlug = capabilities.booking.enabled && capabilities.booking.mode === 'pms' ? capabilities.booking.tenantSlug : null;
  const t = (s?: string | null) => interpolate(s, templateVars);
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
            {t(block.props.heading)}
          </h2>
          {block.props.text && (
            <p className="mt-3 max-w-xl text-base opacity-90">{t(block.props.text)}</p>
          )}
          {pmsSlug ? (
            <button
              onClick={() => setBookingOpen(true)}
              className="mt-6 inline-flex cursor-pointer rounded-full bg-white px-7 py-3 font-semibold transition-opacity hover:opacity-90"
              style={{ color: 'var(--color-accent-text)' }}
            >
              {t(block.props.buttonLabel)}
            </button>
          ) : (
            <a
              href={bookingUrl}
              className="mt-6 inline-flex rounded-full bg-white px-7 py-3 font-semibold transition-opacity hover:opacity-90"
              style={{ color: 'var(--color-accent-text)' }}
            >
              {t(block.props.buttonLabel)}
            </a>
          )}
        </div>
      </div>
      {pmsSlug && <BookingDialog tenantSlug={pmsSlug} open={bookingOpen} onClose={() => setBookingOpen(false)} previewToken={previewToken} />}
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

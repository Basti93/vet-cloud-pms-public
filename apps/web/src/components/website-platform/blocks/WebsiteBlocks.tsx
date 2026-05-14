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

const section = 'mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8';

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

export function HeroBlock({ block, capabilities, assetMap }: BlockProps<Extract<WebsitePageBlock, { type: 'hero' }>>) {
  const [bookingOpen, setBookingOpen] = useState(false);
  const imageUrl = resolveAssetUrl(block.props.image, assetMap);
  const bookingUrl = getBookingUrl(capabilities);
  const pmsSlug = capabilities.booking.enabled && capabilities.booking.mode === 'pms' ? capabilities.booking.tenantSlug : null;

  return (
    <section className="bg-[var(--color-accent-soft)]">
      <div className={`${section} grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]`}>
        <div>
          {block.props.eyebrow && <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-accent-text)]">{block.props.eyebrow}</p>}
          <h1 className="text-4xl font-bold tracking-tight text-fg sm:text-5xl" style={{ fontFamily: 'var(--font-heading)' }}>{block.props.title}</h1>
          {block.props.subtitle && <p className="mt-5 max-w-2xl text-lg text-muted">{block.props.subtitle}</p>}
          <div className="mt-8 flex flex-wrap gap-3">
            {bookingUrl && (
              pmsSlug
                ? <button onClick={() => setBookingOpen(true)} className="rounded-full bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-white shadow-sm">{block.props.primaryCtaLabel}</button>
                : <a href={bookingUrl} className="rounded-full bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-white shadow-sm">{block.props.primaryCtaLabel}</a>
            )}
            <a href="#kontakt" className="rounded-full border border-[var(--color-border-strong)] bg-white px-6 py-3 text-sm font-semibold text-fg">{block.props.secondaryCtaLabel}</a>
          </div>
        </div>
        {imageUrl && <img src={imageUrl} alt={block.props.image?.altOverride ?? ''} className="aspect-[4/3] w-full rounded-[2rem] object-cover shadow-xl" />}
      </div>
      {pmsSlug && <BookingDialog tenantSlug={pmsSlug} open={bookingOpen} onClose={() => setBookingOpen(false)} />}
    </section>
  );
}

export function RichTextBlock({ block }: BlockProps<Extract<WebsitePageBlock, { type: 'richText' }>>) {
  return <section className={section}>{block.props.heading && <h2 className="mb-5 text-3xl font-bold">{block.props.heading}</h2>}<div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: block.props.html }} /></section>;
}

export function ServicesGridBlock({ block }: BlockProps<Extract<WebsitePageBlock, { type: 'servicesGrid' }>>) {
  return <section className={section}><h2 className="text-3xl font-bold">{block.props.heading}</h2>{block.props.intro && <p className="mt-3 text-muted">{block.props.intro}</p>}<div className="mt-8 grid gap-4 md:grid-cols-3">{block.props.services.map((service) => <article key={service.id} className="rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-sm"><h3 className="font-semibold">{service.title}</h3><p className="mt-2 text-sm text-muted">{service.description}</p></article>)}</div></section>;
}

export function TeamListBlock({ block, assetMap }: BlockProps<Extract<WebsitePageBlock, { type: 'teamList' }>>) {
  return <section className={section}><h2 className="text-3xl font-bold">{block.props.heading}</h2>{block.props.intro && <p className="mt-3 max-w-3xl text-muted">{block.props.intro}</p>}<div className="mt-8 grid gap-5 md:grid-cols-2">{block.props.people.map((person) => { const image = resolveAssetUrl(person.image, assetMap); return <article key={person.id} className="flex gap-5 rounded-2xl border border-[var(--color-border)] bg-white p-5 shadow-sm">{image && <img src={image} alt={person.image?.altOverride ?? person.name} className="h-24 w-24 rounded-2xl object-cover" />}<div><h3 className="font-semibold">{person.name}</h3>{person.title && <p className="text-sm text-muted">{person.title}</p>}{person.bio && <p className="mt-2 text-sm text-muted">{person.bio}</p>}<div className="mt-3 flex flex-wrap gap-2">{person.focus.map((focus) => <span key={focus} className="rounded-full bg-[var(--color-accent-soft)] px-2.5 py-1 text-xs text-[var(--color-accent-text)]">{focus}</span>)}</div></div></article>; })}</div></section>;
}

export function HoursTableBlock({ block, tenantHoursRows }: BlockProps<Extract<WebsitePageBlock, { type: 'hoursTable' }>>) {
  const effectiveSections = !block.props.useManualOverride && tenantHoursRows
    ? [{ id: 'tenant', title: 'Sprechzeiten', rows: tenantHoursRows }]
    : block.props.sections;

  return <section className={section}><h2 className="text-3xl font-bold">{block.props.heading}</h2><div className="mt-8 grid gap-4 md:grid-cols-2">{effectiveSections.map((item) => <article key={item.id} className="rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-sm"><div className="mb-4 flex items-center gap-2"><Clock className="h-5 w-5 text-[var(--color-accent-text)]" /><h3 className="font-semibold">{item.title}</h3></div>{item.rows.map((row) => <div key={`${row.days}-${row.time}`} className="flex justify-between border-t border-[var(--color-border)] py-2 text-sm"><span>{row.days}</span><span className="font-medium">{row.time}</span></div>)}{('note' in item && item.note) && <p className="mt-3 text-sm text-muted">{item.note}</p>}</article>)}</div></section>;
}

export function ContactCardBlock({ block, tenantContactInfo }: BlockProps<Extract<WebsitePageBlock, { type: 'contactCard' }>>) {
  const address = !block.props.useManualOverride && tenantContactInfo
    ? [tenantContactInfo.address, tenantContactInfo.city].filter(Boolean).join('\n') || undefined
    : block.props.address;
  const phone = !block.props.useManualOverride && tenantContactInfo ? tenantContactInfo.phone ?? undefined : block.props.phone;
  const email = !block.props.useManualOverride && tenantContactInfo ? tenantContactInfo.email ?? undefined : block.props.email;

  return <section id="kontakt" className={section}><div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-[var(--color-border)]"><h2 className="text-3xl font-bold">{block.props.heading}</h2>{block.props.description && <p className="mt-3 text-muted">{block.props.description}</p>}<div className="mt-6 grid gap-4 md:grid-cols-3">{phone && <p className="flex gap-3"><Phone className="h-5 w-5 text-[var(--color-accent-text)]" />{phone}</p>}{email && <p className="flex gap-3"><Mail className="h-5 w-5 text-[var(--color-accent-text)]" />{email}</p>}{address && <p className="flex gap-3 whitespace-pre-line"><MapPin className="h-5 w-5 text-[var(--color-accent-text)]" />{address}</p>}</div></div></section>;
}

export function ContactFormBlock({ block, projectId, pagePath }: BlockProps<Extract<WebsitePageBlock, { type: 'contactForm' }>>) {
  return <section className={section}><form action="/api/website-leads" method="post" className="mx-auto max-w-2xl rounded-3xl border border-[var(--color-border)] bg-white p-6 shadow-sm"><h2 className="text-2xl font-bold">{block.props.heading}</h2><input type="hidden" name="websiteProjectId" value={projectId} /><input type="hidden" name="sourcePagePath" value={pagePath} /><div className="mt-5 grid gap-3"><input name="name" required placeholder="Name" className="rounded-xl border border-[var(--color-border)] px-4 py-3" /><input name="email" type="email" required placeholder="E-Mail" className="rounded-xl border border-[var(--color-border)] px-4 py-3" /><input name="phone" placeholder="Telefon optional" className="rounded-xl border border-[var(--color-border)] px-4 py-3" /><textarea name="message" required placeholder="Nachricht" rows={5} className="rounded-xl border border-[var(--color-border)] px-4 py-3" /><label className="flex gap-2 text-sm text-muted"><input type="checkbox" name="consent" value="true" required />{block.props.consentLabel}</label><button className="rounded-full bg-[var(--color-accent)] px-5 py-3 font-semibold text-white">Absenden</button></div></form></section>;
}

export function BookingCtaBlock({ block, capabilities }: BlockProps<Extract<WebsitePageBlock, { type: 'bookingCta' }>>) {
  const [bookingOpen, setBookingOpen] = useState(false);
  const bookingUrl = getBookingUrl(capabilities);
  const pmsSlug = capabilities.booking.enabled && capabilities.booking.mode === 'pms' ? capabilities.booking.tenantSlug : null;
  if (!bookingUrl) return null;

  return (
    <section className={section}>
      <div className="rounded-3xl bg-[var(--color-accent)] p-8 text-white shadow-lg">
        <Calendar className="mb-4 h-8 w-8" />
        <h2 className="text-3xl font-bold">{block.props.heading}</h2>
        {block.props.text && <p className="mt-3 opacity-90">{block.props.text}</p>}
        {pmsSlug
          ? <button onClick={() => setBookingOpen(true)} className="mt-6 inline-flex rounded-full bg-white px-6 py-3 font-semibold text-[var(--color-accent-text)]">{block.props.buttonLabel}</button>
          : <a href={bookingUrl} className="mt-6 inline-flex rounded-full bg-white px-6 py-3 font-semibold text-[var(--color-accent-text)]">{block.props.buttonLabel}</a>
        }
      </div>
      {pmsSlug && <BookingDialog tenantSlug={pmsSlug} open={bookingOpen} onClose={() => setBookingOpen(false)} />}
    </section>
  );
}

export function MapEmbedBlock({ block, tenantContactInfo }: BlockProps<Extract<WebsitePageBlock, { type: 'mapEmbed' }>>) {
  const address = !block.props.useManualOverride && tenantContactInfo
    ? [tenantContactInfo.address, tenantContactInfo.city].filter(Boolean).join(', ') || undefined
    : block.props.address;

  const embedSrc = block.props.embedUrl || (address ? `https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed` : null);

  return <section className={section}>{block.props.heading && <h2 className="mb-5 text-3xl font-bold">{block.props.heading}</h2>}{embedSrc ? <iframe src={embedSrc} className="h-80 w-full rounded-3xl border-0 shadow-sm" loading="lazy" /> : null}</section>;
}

export function LegalTextBlock({ block }: BlockProps<Extract<WebsitePageBlock, { type: 'legalText' }>>) {
  return <section className={section}><h1 className="text-3xl font-bold">{block.props.heading}</h1><div className="prose mt-6 max-w-none" dangerouslySetInnerHTML={{ __html: block.props.html }} /></section>;
}

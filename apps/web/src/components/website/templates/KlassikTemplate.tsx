'use client';

import { Mail, Phone, MapPin } from 'lucide-react';

interface KlassikTemplateProps {
  brandName: string;
  tagline: string;
  monogram: string;
  slug: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  hours?: Array<{ day: string; time: string }>;
}

export function KlassikTemplate({
  brandName,
  tagline,
  monogram,
  slug,
  phone = '+49 123 456789',
  email = 'kontakt@praxis.de',
  address = 'Musterstraße 1',
  city = 'Musterstadt',
  hours = [{ day: 'Mo–Fr', time: '08:00–18:00' }],
}: KlassikTemplateProps) {
  return (
    <div className="min-h-screen bg-bg text-fg">
      {/* Header */}
      <header
        className="py-20 px-4 sm:px-6 lg:px-8 text-center"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderBottom: '2px solid var(--color-border)',
        }}
      >
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-center mb-6">
            <div
              className="w-16 h-16 rounded-lg flex items-center justify-center text-white font-bold text-2xl"
              style={{
                backgroundColor: 'var(--color-accent)',
              }}
            >
              {monogram}
            </div>
          </div>
          <h1
            className="text-5xl font-bold mb-4"
            style={{
              fontFamily: 'var(--font-heading)',
            }}
          >
            {brandName}
          </h1>
          <p
            className="text-xl mb-8"
            style={{
              fontFamily: 'var(--font-heading)',
              color: 'var(--color-accent)',
            }}
          >
            {tagline}
          </p>
          <a
            href={`/book/${slug}`}
            className="px-8 py-3 rounded-lg text-white font-medium transition-all inline-block"
            style={{ backgroundColor: 'var(--color-accent)' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'var(--color-accent-hover)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'var(--color-accent)';
            }}
          >
            Termin buchen
          </a>
        </div>
      </header>

      {/* About Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center">
          <h2
            className="text-3xl font-bold mb-6"
            style={{
              fontFamily: 'var(--font-heading)',
            }}
          >
            Über uns
          </h2>
          <p className="text-lg text-muted mb-8 leading-relaxed">
            Willkommen in unserer modernen Tierarztpraxis. Mit jahrelanger Erfahrung und modernen medizinischen
            Einrichtungen bieten wir die beste Betreuung für Ihre Haustiere.
          </p>
        </div>
      </section>

      {/* Services */}
      <section
        className="py-20 px-4 sm:px-6 lg:px-8"
        style={{
          backgroundColor: 'var(--color-accent-soft)',
        }}
      >
        <div className="max-w-2xl mx-auto text-center">
          <h2
            className="text-3xl font-bold mb-12"
            style={{
              fontFamily: 'var(--font-heading)',
            }}
          >
            Leistungen
          </h2>
          <div className="space-y-6">
            {[
              'Allgemeine Sprechstunde',
              'Zahnbehandlung',
              'Chirurgische Eingriffe',
              'Ultraschalluntersuchungen',
              'Impfungen und Vorsorge',
              'Notfallbetreuung',
            ].map((service) => (
              <div key={service} className="py-3 border-b border-[var(--color-border)] last:border-b-0">
                <p className="text-lg">{service}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Hours Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <h2
            className="text-3xl font-bold text-center mb-12"
            style={{
              fontFamily: 'var(--font-heading)',
            }}
          >
            Öffnungszeiten
          </h2>
          <div className="space-y-4 text-center">
            {hours.map((h, i) => (
              <div key={i}>
                <p className="font-bold text-lg">{h.day}</p>
                <p className="text-muted">{h.time}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section
        className="py-20 px-4 sm:px-6 lg:px-8"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderTop: '2px solid var(--color-border)',
        }}
      >
        <div className="max-w-2xl mx-auto text-center">
          <h2
            className="text-3xl font-bold mb-12"
            style={{
              fontFamily: 'var(--font-heading)',
            }}
          >
            Kontakt
          </h2>
          <div className="space-y-6">
            <div>
              <div className="flex justify-center mb-2">
                <Phone className="w-6 h-6" style={{ color: 'var(--color-accent)' }} />
              </div>
              <p className="font-bold">{phone}</p>
            </div>
            <div>
              <div className="flex justify-center mb-2">
                <Mail className="w-6 h-6" style={{ color: 'var(--color-accent)' }} />
              </div>
              <p className="font-bold">{email}</p>
            </div>
            <div>
              <div className="flex justify-center mb-2">
                <MapPin className="w-6 h-6" style={{ color: 'var(--color-accent)' }} />
              </div>
              <p className="font-bold">
                {address}
                <br />
                {city}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-fg text-surface py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center text-sm">
          <p>&copy; {new Date().getFullYear()} {brandName}. Alle Rechte vorbehalten.</p>
        </div>
      </footer>
    </div>
  );
}

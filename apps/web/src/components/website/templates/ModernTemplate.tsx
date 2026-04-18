import { Mail, Phone, MapPin, Clock, ArrowRight } from 'lucide-react';

interface ModernTemplateProps {
  brandName: string;
  tagline: string;
  monogram: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
}

export function ModernTemplate({
  brandName,
  tagline,
  monogram,
  phone = '+49 123 456789',
  email = 'kontakt@praxis.de',
  address = 'Musterstraße 1',
  city = 'Musterstadt',
}: ModernTemplateProps) {
  return (
    <div className="min-h-screen bg-bg text-fg">
      {/* Header */}
      <header className="sticky top-0 bg-surface border-b border-[var(--color-border)] z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
              style={{
                backgroundColor: 'var(--color-accent)',
              }}
            >
              {monogram}
            </div>
            <div>
              <h1 className="font-bold text-lg" style={{ fontFamily: 'var(--font-heading)' }}>
                {brandName}
              </h1>
              <p className="text-xs text-muted">{tagline}</p>
            </div>
          </div>
          <button
            className="px-6 py-2.5 rounded-lg text-white font-medium transition-all"
            style={{
              backgroundColor: 'var(--color-accent)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-accent-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-accent)';
            }}
          >
            Termin buchen
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section
        className="py-20 px-4 sm:px-6 lg:px-8"
        style={{
          backgroundColor: 'var(--color-accent-soft)',
        }}
      >
        <div className="max-w-4xl mx-auto text-center">
          <h2
            className="text-4xl md:text-5xl font-bold mb-6"
            style={{
              fontFamily: 'var(--font-heading)',
              color: 'var(--color-accent-text)',
            }}
          >
            Kompetente Tiermedizin für Ihr Haustier
          </h2>
          <p className="text-lg text-muted mb-8">
            Wir sind Ihre vertrauenswürdige Tierarztpraxis mit modernen Einrichtungen und erfahrenem Personal.
          </p>
          <button
            className="px-8 py-4 rounded-lg text-white font-medium inline-flex items-center gap-2 transition-all"
            style={{
              backgroundColor: 'var(--color-accent)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-accent-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-accent)';
            }}
          >
            Online Termin buchen <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <h3
            className="text-3xl font-bold text-center mb-12"
            style={{
              fontFamily: 'var(--font-heading)',
            }}
          >
            Unsere Leistungen
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { title: 'Allgemeine Sprechstunde', desc: 'Untersuchung und Beratung' },
              { title: 'Chirurgie', desc: 'Operative Eingriffe' },
              { title: 'Zahnbehandlung', desc: 'Zahnreinigung und -behandlung' },
            ].map((service) => (
              <div
                key={service.title}
                className="p-6 rounded-lg border border-[var(--color-border)] hover:border-primary transition-all"
              >
                <h4 className="font-bold text-lg text-fg mb-2">{service.title}</h4>
                <p className="text-muted">{service.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="bg-surface border-t border-[var(--color-border)] py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <h3
            className="text-3xl font-bold text-center mb-12"
            style={{
              fontFamily: 'var(--font-heading)',
            }}
          >
            Kontakt & Öffnungszeiten
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {/* Contact Info */}
            <div className="space-y-6">
              <div className="flex gap-4">
                <Phone className="w-6 h-6 flex-shrink-0" style={{ color: 'var(--color-accent)' }} />
                <div>
                  <p className="font-bold">Telefon</p>
                  <p className="text-muted">{phone}</p>
                </div>
              </div>
              <div className="flex gap-4">
                <Mail className="w-6 h-6 flex-shrink-0" style={{ color: 'var(--color-accent)' }} />
                <div>
                  <p className="font-bold">Email</p>
                  <p className="text-muted">{email}</p>
                </div>
              </div>
              <div className="flex gap-4">
                <MapPin className="w-6 h-6 flex-shrink-0" style={{ color: 'var(--color-accent)' }} />
                <div>
                  <p className="font-bold">Adresse</p>
                  <p className="text-muted">
                    {address}
                    <br />
                    {city}
                  </p>
                </div>
              </div>
            </div>

            {/* Hours */}
            <div>
              <div className="flex gap-4 mb-6">
                <Clock className="w-6 h-6 flex-shrink-0" style={{ color: 'var(--color-accent)' }} />
                <div>
                  <p className="font-bold mb-3">Öffnungszeiten</p>
                  <div className="space-y-2 text-muted">
                    <p>Montag - Freitag: 08:00 - 18:00 Uhr</p>
                    <p>Samstag: 09:00 - 13:00 Uhr</p>
                    <p>Sonntag: Geschlossen</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-fg text-surface py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto text-center text-sm">
          <p>&copy; {new Date().getFullYear()} {brandName}. Alle Rechte vorbehalten.</p>
        </div>
      </footer>
    </div>
  );
}

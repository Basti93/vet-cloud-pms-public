import { Mail, Phone, MapPin, Clock } from 'lucide-react';

interface KompaktTemplateProps {
  brandName: string;
  tagline: string;
  monogram: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
}

export function KompaktTemplate({
  brandName,
  tagline,
  monogram,
  phone = '+49 123 456789',
  email = 'kontakt@praxis.de',
  address = 'Musterstraße 1',
  city = 'Musterstadt',
}: KompaktTemplateProps) {
  return (
    <div className="min-h-screen bg-bg p-4 sm:p-6 flex items-center justify-center">
      <div className="w-full max-w-md">
        {/* Main Card */}
        <div className="bg-surface rounded-2xl border border-[var(--color-border)] overflow-hidden shadow-xl">
          {/* Header */}
          <div
            className="p-8 text-center"
            style={{
              backgroundColor: 'var(--color-accent-soft)',
            }}
          >
            <div className="flex justify-center mb-4">
              <div
                className="w-14 h-14 rounded-lg flex items-center justify-center text-white font-bold text-xl"
                style={{
                  backgroundColor: 'var(--color-accent)',
                }}
              >
                {monogram}
              </div>
            </div>
            <h1
              className="text-2xl font-bold mb-2"
              style={{
                fontFamily: 'var(--font-heading)',
                color: 'var(--color-accent-text)',
              }}
            >
              {brandName}
            </h1>
            <p className="text-sm text-muted">{tagline}</p>
          </div>

          {/* CTA Button */}
          <div className="p-6 border-b border-[var(--color-border)]">
            <button
              className="w-full px-6 py-3 rounded-lg text-white font-medium transition-all"
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
              Online Termin buchen
            </button>
          </div>

          {/* Contact Info - Grid */}
          <div className="p-6 space-y-4">
            <h3
              className="font-bold text-center text-lg"
              style={{
                fontFamily: 'var(--font-heading)',
              }}
            >
              Kontakt
            </h3>

            {/* Phone */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted-soft">
              <Phone className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--color-accent)' }} />
              <div>
                <p className="text-xs text-muted font-medium">Telefon</p>
                <p className="font-bold text-sm">{phone}</p>
              </div>
            </div>

            {/* Email */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted-soft">
              <Mail className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--color-accent)' }} />
              <div>
                <p className="text-xs text-muted font-medium">Email</p>
                <p className="font-bold text-sm break-all">{email}</p>
              </div>
            </div>

            {/* Address */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted-soft">
              <MapPin className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--color-accent)' }} />
              <div>
                <p className="text-xs text-muted font-medium">Adresse</p>
                <p className="font-bold text-sm">
                  {address}
                  <br />
                  {city}
                </p>
              </div>
            </div>

            {/* Hours */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted-soft">
              <Clock className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--color-accent)' }} />
              <div>
                <p className="text-xs text-muted font-medium">Öffnungszeiten</p>
                <p className="font-bold text-sm">
                  Mo–Fr: 08:00–18:00
                  <br />
                  Sa: 09:00–13:00
                </p>
              </div>
            </div>
          </div>

          {/* Services */}
          <div className="p-6 border-t border-[var(--color-border)]">
            <h3
              className="font-bold text-center text-sm mb-3"
              style={{
                fontFamily: 'var(--font-heading)',
              }}
            >
              Leistungen
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {['Sprechstunde', 'Zahnbehandlung', 'Chirurgie', 'Ultraschall'].map((service) => (
                <div
                  key={service}
                  className="text-xs p-2 rounded text-center"
                  style={{
                    backgroundColor: 'var(--color-accent-soft)',
                    color: 'var(--color-accent-text)',
                  }}
                >
                  {service}
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div
            className="p-4 text-center text-xs"
            style={{
              backgroundColor: 'var(--color-muted-soft)',
              color: 'var(--color-muted)',
            }}
          >
            <p>&copy; {new Date().getFullYear()} {brandName}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

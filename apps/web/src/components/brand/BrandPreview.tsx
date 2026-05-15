'use client';

import { useMemo } from 'react';
import { generateCSSVariables, ColorPresetKey, TypographyPairingKey, WebsiteTemplateKey } from '@/lib/theme';
import { Phone, MapPin, Clock } from 'lucide-react';

interface BrandPreviewProps {
  colorPreset: ColorPresetKey;
  typographyPairing: TypographyPairingKey;
  template?: WebsiteTemplateKey;
  brandName: string;
  tagline: string;
  monogram: string;
}

export function BrandPreview({
  colorPreset,
  typographyPairing,
  template = 'modern',
  brandName,
  tagline,
  monogram,
}: BrandPreviewProps) {
  // Generate CSS variables for the preview
  const cssVariables = useMemo(
    () => generateCSSVariables(colorPreset, typographyPairing),
    [colorPreset, typographyPairing]
  );

  // Parse CSS variables into a style object
  const themeStyles = useMemo(() => {
    const styles: Record<string, string> = {};
    cssVariables.split('\n').forEach((line) => {
      const [key, value] = line.replace(/;$/, '').split(':');
      if (key && value) {
        styles[key.trim()] = value.trim();
      }
    });
    return styles;
  }, [cssVariables]);

  const previewName = brandName || 'Musterpraxis';
  const previewTagline = tagline || 'Ihre Tierarztpraxis vor Ort';
  const previewMonogram = monogram || 'MP';

  const themeProps = {
    '--color-accent': themeStyles['--color-accent'],
    '--color-accent-hover': themeStyles['--color-accent-hover'],
    '--color-accent-soft': themeStyles['--color-accent-soft'],
    '--color-accent-text': themeStyles['--color-accent-text'],
    '--color-bg': themeStyles['--color-bg'],
    '--color-surface': themeStyles['--color-surface'],
    '--color-border': themeStyles['--color-border'],
    '--color-border-strong': themeStyles['--color-border-strong'],
    '--color-fg': themeStyles['--color-fg'],
    '--color-muted': themeStyles['--color-muted'],
    '--color-muted-soft': themeStyles['--color-muted-soft'],
    '--font-heading': themeStyles['--font-heading'],
    '--font-body': themeStyles['--font-body'],
    '--font-heading-weight': themeStyles['--font-heading-weight'],
    '--font-heading-tracking': themeStyles['--font-heading-tracking'],
  } as React.CSSProperties;

  const renderTemplate = () => {
    if (template === 'kompakt') {
      return (
        <div style={themeProps} className="bg-bg text-fg min-h-[600px] flex flex-col p-6">
          {/* Kompakt: Card-based, all content visible */}
          <div className="flex items-center justify-center mb-8">
            <div
              className="w-16 h-16 rounded-lg flex items-center justify-center text-white font-bold text-2xl"
              style={{ backgroundColor: 'var(--color-accent)' }}
            >
              {previewMonogram}
            </div>
          </div>
          <h1 className="text-center text-2xl font-bold mb-2" style={{ fontFamily: 'var(--font-heading)' }}>
            {previewName}
          </h1>
          <p className="text-center text-sm mb-8" style={{ color: 'var(--color-muted)' }}>
            {previewTagline}
          </p>
          <button
            className="w-full px-4 py-3 rounded-lg text-white font-medium mb-8"
            style={{ backgroundColor: 'var(--color-accent)' }}
          >
            Termin buchen
          </button>
          <div className="bg-surface rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Phone className="w-4 h-4 mt-1 flex-shrink-0" style={{ color: 'var(--color-accent)' }} />
              <div className="text-sm">
                <p className="font-medium">+49 123 456789</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 mt-1 flex-shrink-0" style={{ color: 'var(--color-accent)' }} />
              <div className="text-sm">
                <p className="font-medium">Musterstraße 1, 12345</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="w-4 h-4 mt-1 flex-shrink-0" style={{ color: 'var(--color-accent)' }} />
              <div className="text-sm">
                <p className="font-medium">Mo-Fr: 08:00 - 18:00</p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (template === 'klassik') {
      return (
        <div style={themeProps} className="bg-bg text-fg min-h-[600px] flex flex-col">
          {/* Klassik: Centered, traditional layout */}
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
            <div
              className="w-20 h-20 rounded-lg flex items-center justify-center text-white font-bold text-3xl mb-6"
              style={{ backgroundColor: 'var(--color-accent)' }}
            >
              {previewMonogram}
            </div>
            <h1 className="text-3xl font-bold text-center mb-2" style={{ fontFamily: 'var(--font-heading)' }}>
              {previewName}
            </h1>
            <p className="text-center text-lg mb-12" style={{ color: 'var(--color-muted)' }}>
              {previewTagline}
            </p>
            <button
              className="px-8 py-3 rounded-lg text-white font-medium mb-12"
              style={{ backgroundColor: 'var(--color-accent)' }}
            >
              Termin buchen
            </button>
          </div>
          <div
            className="border-t px-6 py-8"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
          >
            <div className="grid grid-cols-3 gap-4 text-center text-sm">
              <div>
                <Phone className="w-5 h-5 mx-auto mb-2" style={{ color: 'var(--color-accent)' }} />
                <p className="font-medium">+49 123 456789</p>
              </div>
              <div>
                <MapPin className="w-5 h-5 mx-auto mb-2" style={{ color: 'var(--color-accent)' }} />
                <p className="font-medium">Musterstraße 1</p>
              </div>
              <div>
                <Clock className="w-5 h-5 mx-auto mb-2" style={{ color: 'var(--color-accent)' }} />
                <p className="font-medium">Mo-Fr 08:00-18:00</p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Modern (default)
    return (
      <div style={themeProps} className="bg-bg text-fg min-h-[600px] flex flex-col">
        {/* Header/Logo */}
        <div className="bg-surface border-b border-[var(--color-border)] px-6 py-6">
          <div className="flex items-center gap-4 mb-4">
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg"
              style={{ backgroundColor: 'var(--color-accent)' }}
            >
              {previewMonogram}
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
                {previewName}
              </h1>
              <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
                {previewTagline}
              </p>
            </div>
          </div>
        </div>

        {/* Hero Section */}
        <div
          className="px-6 py-8"
          style={{
            backgroundColor: 'var(--color-accent-soft)',
          }}
        >
          <h2
            className="text-2xl font-bold mb-2"
            style={{
              fontFamily: 'var(--font-heading)',
              color: 'var(--color-accent-text)',
            }}
          >
            Online Terminbuchung
          </h2>
          <p style={{ color: 'var(--color-muted)' }}>
            Buchen Sie einen Termin für Ihr Tier
          </p>
        </div>

        {/* CTA Button */}
        <div className="px-6 py-6">
          <button
            className="w-full px-4 py-3 rounded-lg text-white font-medium transition-all"
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

        {/* Contact Info */}
        <div className="px-6 py-6 border-t border-[var(--color-border)] mt-auto">
          <h3
            className="font-bold mb-4"
            style={{
              fontFamily: 'var(--font-heading)',
            }}
          >
            Kontaktinformationen
          </h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Phone className="w-4 h-4 mt-1 flex-shrink-0" style={{ color: 'var(--color-accent)' }} />
              <div>
                <p className="text-sm font-medium">Telefon</p>
                <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                  +49 123 456789
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 mt-1 flex-shrink-0" style={{ color: 'var(--color-accent)' }} />
              <div>
                <p className="text-sm font-medium">Adresse</p>
                <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                  Musterstraße 1, 12345 Musterstadt
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="w-4 h-4 mt-1 flex-shrink-0" style={{ color: 'var(--color-accent)' }} />
              <div>
                <p className="text-sm font-medium">Öffnungszeiten</p>
                <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                  Mo-Fr: 08:00 - 18:00
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="sticky top-6">
      <div className="rounded-lg overflow-hidden shadow-lg border border-[var(--color-border)]">
        {renderTemplate()}

        {/* Template Indicator */}
        <div className="bg-muted-soft px-4 py-2 text-xs text-muted text-center">
          Vorlage: {template === 'modern' ? 'Modern' : template === 'klassik' ? 'Klassik' : 'Kompakt'}
        </div>
      </div>
    </div>
  );
}

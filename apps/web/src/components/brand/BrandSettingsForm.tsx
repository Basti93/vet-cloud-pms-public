import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  COLOR_PRESETS,
  TYPE_PAIRINGS,
  WEBSITE_TEMPLATES,
  ColorPresetKey,
  TypographyPairingKey,
  WebsiteTemplateKey,
} from '@/lib/theme';
import { CheckCircle } from 'lucide-react';

interface BrandSettingsFormProps {
  colorPreset: ColorPresetKey;
  onColorPresetChange: (preset: ColorPresetKey) => void;
  typographyPairing: TypographyPairingKey;
  onTypographyPairingChange: (pairing: TypographyPairingKey) => void;
  template: WebsiteTemplateKey;
  onTemplateChange: (template: WebsiteTemplateKey) => void;
  brandName?: string;
  onBrandNameChange?: (name: string) => void;
  tagline?: string;
  onTaglineChange?: (tagline: string) => void;
  monogram?: string;
  onMonogramChange?: (monogram: string) => void;
  showBrandingFields?: boolean;
  onSave: () => void;
  isSaving: boolean;
  canSave: boolean;
  saveSuccess: boolean;
}

export function BrandSettingsForm({
  colorPreset,
  onColorPresetChange,
  typographyPairing,
  onTypographyPairingChange,
  template,
  onTemplateChange,
  brandName = "",
  onBrandNameChange = () => {},
  tagline = "",
  onTaglineChange = () => {},
  monogram = "",
  onMonogramChange = () => {},
  showBrandingFields = true,
  onSave,
  isSaving,
  canSave,
  saveSuccess,
}: BrandSettingsFormProps) {
  return (
    <div className="space-y-6">
      {/* Brand Identity - Optional */}
      {showBrandingFields && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-fg mb-4">Branding</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-fg mb-2">Praxisname</label>
              <input
                type="text"
                value={brandName}
                onChange={(e) => onBrandNameChange(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                maxLength={100}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-fg mb-2">Tagline</label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => onTaglineChange(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="z.B. Ihre Tierarztpraxis vor Ort"
                maxLength={200}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-fg mb-2">Monogramm</label>
              <input
                type="text"
                value={monogram}
                onChange={(e) => onMonogramChange(e.target.value.slice(0, 3).toUpperCase())}
                className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="z.B. MP"
                maxLength={3}
              />
            </div>
          </div>
        </Card>
      )}

      {/* Color Preset */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-fg mb-4">Farbpalette</h3>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(COLOR_PRESETS).map(([key, preset]) => (
            <button
              key={key}
              onClick={() => onColorPresetChange(key as ColorPresetKey)}
              className={`p-3 rounded-lg border-2 transition-all ${
                colorPreset === key
                  ? 'border-primary ring-2 ring-primary ring-offset-2'
                  : 'border-[var(--color-border)] hover:border-primary'
              }`}
            >
              <div className="flex items-start gap-2">
                <div
                  className="w-8 h-8 rounded-lg border border-[var(--color-border)]"
                  style={{
                    backgroundColor: preset.accent,
                  }}
                />
                <div className="text-left">
                  <p className="font-medium text-sm text-fg">{preset.label}</p>
                  <p className="text-xs text-muted">{preset.sub}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </Card>

      {/* Typography Pairing */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-fg mb-4">Typografie</h3>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(TYPE_PAIRINGS).map(([key, typography]) => (
            <button
              key={key}
              onClick={() => onTypographyPairingChange(key as TypographyPairingKey)}
              className={`p-3 rounded-lg border-2 transition-all text-left ${
                typographyPairing === key
                  ? 'border-primary ring-2 ring-primary ring-offset-2'
                  : 'border-[var(--color-border)] hover:border-primary'
              }`}
            >
              <p
                className="font-semibold text-sm mb-1"
                style={{ fontFamily: typography.heading }}
              >
                {typography.label}
              </p>
              <p className="text-xs text-muted">{typography.sub}</p>
            </button>
          ))}
        </div>
      </Card>

      {/* Website Template */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-fg mb-4">Website-Vorlage</h3>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(WEBSITE_TEMPLATES).map(([key, tmpl]) => (
            <button
              key={key}
              onClick={() => onTemplateChange(key as WebsiteTemplateKey)}
              className={`p-3 rounded-lg border-2 transition-all text-left ${
                template === key
                  ? 'border-primary ring-2 ring-primary ring-offset-2'
                  : 'border-[var(--color-border)] hover:border-primary'
              }`}
            >
              <p className="font-medium text-sm text-fg">{tmpl.label}</p>
              <p className="text-xs text-muted">{tmpl.sub}</p>
            </button>
          ))}
        </div>
      </Card>

      {/* Save Button */}
      <Card className="p-6 bg-surface border-[var(--color-border)]">
        {!canSave ? (
          <div className="text-center py-4">
            <p className="text-muted mb-4">Melden Sie sich an, um Ihre Einstellungen zu speichern</p>
            <Button
              variant="default"
              onClick={() => {
                // TODO: Redirect to sign-up
                window.location.href = '/sign-up?redirect=/brand-builder/' + brandName;
              }}
            >
              Kostenlos anmelden
            </Button>
          </div>
        ) : (
          <div>
            <Button
              variant="default"
              onClick={onSave}
              disabled={isSaving}
              className="w-full text-white font-medium"
            >
              {isSaving ? 'Speichern...' : 'Einstellungen speichern'}
            </Button>
            {saveSuccess && (
              <div className="mt-3 flex items-center gap-2 text-green-700 text-sm">
                <CheckCircle className="w-4 h-4" />
                Erfolgreich gespeichert!
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

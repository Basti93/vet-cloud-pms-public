// Vet Cloud PMS — Tenant Theme System
// Single source of truth for colors, typography, brand across app + website

export type ColorPresetKey = "sage" | "warmsand" | "klinikblau" | "bordeaux" | "forest" | "schiefer";
export type TypographyPairingKey = "modern" | "klassisch" | "klinisch" | "freundlich";
export type WebsiteTemplateKey = "klassik" | "modern" | "kompakt";

export interface ColorPreset {
  label: string;
  sub: string;
  accent: string;
  accentHex: string; // Hex equivalent for favicon
  accentHover: string;
  accentSoft: string;
  accentText: string;
  bg: string;
  surface: string;
  border: string;
  borderStrong: string;
  fg: string;
  muted: string;
  mutedSoft: string;
}

export interface TypographyPairing {
  label: string;
  sub: string;
  heading: string;
  body: string;
  headingWeight: number;
  headingTracking: string;
}

export interface WebsiteTemplate {
  label: string;
  sub: string;
}

export interface BrandSettings {
  practiceName: string;
  tagline: string;
  monogram: string;
  address: string;
  phone: string;
  email: string;
  hours: Array<{ day: string; time: string }>;
}

export interface TenantTheme {
  brand: BrandSettings;
  palette: ColorPresetKey;
  type: TypographyPairingKey;
  formality: "Sie" | "du";
  website: {
    enabled: boolean;
    subdomain?: string;
    template: WebsiteTemplateKey;
    sections: {
      hero: boolean;
      ueberuns: boolean;
      team: boolean;
      leistungen: boolean;
      oeffnungszeiten: boolean;
      kontakt: boolean;
      notdienst: boolean;
    };
  };
}

export const COLOR_PRESETS: Record<ColorPresetKey, ColorPreset> = {
  sage: {
    label: "Sage",
    sub: "Ruhig & klinisch",
    accent: "oklch(55% 0.10 165)",
    accentHex: "#5a9b7f",
    accentHover: "oklch(50% 0.10 165)",
    accentSoft: "oklch(95% 0.025 165)",
    accentText: "oklch(35% 0.08 165)",
    bg: "oklch(98.8% 0.004 150)",
    surface: "#ffffff",
    border: "oklch(92% 0.006 150)",
    borderStrong: "oklch(86% 0.008 150)",
    fg: "oklch(22% 0.01 200)",
    muted: "oklch(38% 0.01 200)",
    mutedSoft: "oklch(96% 0.004 150)",
  },
  warmsand: {
    label: "Warm Sand",
    sub: "Erdig & warm",
    accent: "oklch(58% 0.10 70)",
    accentHex: "#d49a5a",
    accentHover: "oklch(53% 0.10 70)",
    accentSoft: "oklch(95% 0.025 70)",
    accentText: "oklch(38% 0.08 70)",
    bg: "oklch(98.5% 0.006 80)",
    surface: "#ffffff",
    border: "oklch(91% 0.008 80)",
    borderStrong: "oklch(85% 0.01 80)",
    fg: "oklch(22% 0.012 60)",
    muted: "oklch(38% 0.012 60)",
    mutedSoft: "oklch(96% 0.006 80)",
  },
  klinikblau: {
    label: "Klinik Blau",
    sub: "Vertrauen & Medizin",
    accent: "oklch(55% 0.11 240)",
    accentHex: "#4a7bc9",
    accentHover: "oklch(50% 0.11 240)",
    accentSoft: "oklch(95% 0.025 240)",
    accentText: "oklch(35% 0.09 240)",
    bg: "oklch(98.5% 0.004 240)",
    surface: "#ffffff",
    border: "oklch(92% 0.006 240)",
    borderStrong: "oklch(86% 0.008 240)",
    fg: "oklch(22% 0.012 240)",
    muted: "oklch(38% 0.012 240)",
    mutedSoft: "oklch(96% 0.004 240)",
  },
  bordeaux: {
    label: "Bordeaux",
    sub: "Premium & boutique",
    accent: "oklch(48% 0.13 25)",
    accentHex: "#a63f46",
    accentHover: "oklch(43% 0.13 25)",
    accentSoft: "oklch(95% 0.025 25)",
    accentText: "oklch(35% 0.10 25)",
    bg: "oklch(98.5% 0.005 30)",
    surface: "#ffffff",
    border: "oklch(91% 0.008 30)",
    borderStrong: "oklch(85% 0.01 30)",
    fg: "oklch(22% 0.012 25)",
    muted: "oklch(38% 0.012 25)",
    mutedSoft: "oklch(96% 0.005 30)",
  },
  forest: {
    label: "Forest",
    sub: "Tief & natürlich",
    accent: "oklch(45% 0.10 150)",
    accentHex: "#3d7956",
    accentHover: "oklch(40% 0.10 150)",
    accentSoft: "oklch(94% 0.025 150)",
    accentText: "oklch(32% 0.08 150)",
    bg: "oklch(98.5% 0.004 150)",
    surface: "#ffffff",
    border: "oklch(91% 0.006 150)",
    borderStrong: "oklch(85% 0.008 150)",
    fg: "oklch(22% 0.012 180)",
    muted: "oklch(38% 0.012 180)",
    mutedSoft: "oklch(96% 0.004 150)",
  },
  schiefer: {
    label: "Schiefer",
    sub: "Pures Neutral",
    accent: "oklch(45% 0.02 250)",
    accentHex: "#6b7280",
    accentHover: "oklch(40% 0.02 250)",
    accentSoft: "oklch(95% 0.005 250)",
    accentText: "oklch(30% 0.015 250)",
    bg: "oklch(98.5% 0.002 250)",
    surface: "#ffffff",
    border: "oklch(91% 0.004 250)",
    borderStrong: "oklch(85% 0.006 250)",
    fg: "oklch(20% 0.008 250)",
    muted: "oklch(36% 0.008 250)",
    mutedSoft: "oklch(96% 0.002 250)",
  },
};

export const TYPE_PAIRINGS: Record<TypographyPairingKey, TypographyPairing> = {
  modern: {
    label: "Modern Sans",
    sub: "Inter — der sichere Standard",
    heading: "'Inter', system-ui, sans-serif",
    body: "'Inter', system-ui, sans-serif",
    headingWeight: 600,
    headingTracking: "-0.011em",
  },
  klassisch: {
    label: "Klassisch",
    sub: "Serif Headlines, Sans Body",
    heading: "'Source Serif 4', Georgia, serif",
    body: "'Inter', system-ui, sans-serif",
    headingWeight: 600,
    headingTracking: "-0.012em",
  },
  klinisch: {
    label: "Klinisch",
    sub: "IBM Plex — am medizinischsten",
    heading: "'IBM Plex Sans', system-ui, sans-serif",
    body: "'IBM Plex Sans', system-ui, sans-serif",
    headingWeight: 600,
    headingTracking: "-0.008em",
  },
  freundlich: {
    label: "Freundlich",
    sub: "Public Sans — etwas wärmer",
    heading: "'Public Sans', system-ui, sans-serif",
    body: "'Inter', system-ui, sans-serif",
    headingWeight: 700,
    headingTracking: "-0.014em",
  },
};

export const WEBSITE_TEMPLATES: Record<WebsiteTemplateKey, WebsiteTemplate> = {
  klassik: {
    label: "Klassik",
    sub: "Mittig, einspaltig, etabliert",
  },
  modern: {
    label: "Modern",
    sub: "Asymmetrisch, vollflächig",
  },
  kompakt: {
    label: "Kompakt",
    sub: "Eine Karte, alles auf einen Blick",
  },
};

export const DEFAULT_THEME: TenantTheme = {
  brand: {
    practiceName: "Musterpraxis",
    tagline: "Ihre Tierarztpraxis in der Musterstadt seit 1998",
    monogram: "MP",
    address: "Musterstraße 1, 00000 Musterstadt",
    phone: "+49 000 000 000",
    email: "praxis@musterpraxis.de",
    hours: [
      { day: "Mo–Fr", time: "08:00 – 18:00" },
      { day: "Sa", time: "09:00 – 13:00" },
      { day: "So", time: "Geschlossen" },
    ],
  },
  palette: "sage",
  type: "modern",
  formality: "Sie",
  website: {
    enabled: true,
    subdomain: "musterpraxis",
    template: "modern",
    sections: {
      hero: true,
      ueberuns: true,
      team: true,
      leistungen: true,
      oeffnungszeiten: true,
      kontakt: true,
      notdienst: false,
    },
  },
};

// Generate CSS variables string from a color preset and typography pairing
export function generateCSSVariables(
  colorPresetKey: ColorPresetKey,
  typographyKey: TypographyPairingKey,
): string {
  const colors = COLOR_PRESETS[colorPresetKey];
  const typography = TYPE_PAIRINGS[typographyKey];

  const vars = [
    `--color-accent: ${colors.accent};`,
    `--color-accent-hover: ${colors.accentHover};`,
    `--color-accent-soft: ${colors.accentSoft};`,
    `--color-accent-text: ${colors.accentText};`,
    `--color-bg: ${colors.bg};`,
    `--color-surface: ${colors.surface};`,
    `--color-border: ${colors.border};`,
    `--color-border-strong: ${colors.borderStrong};`,
    `--color-fg: ${colors.fg};`,
    `--color-muted: ${colors.muted};`,
    `--color-muted-soft: ${colors.mutedSoft};`,
    `--font-heading: ${typography.heading};`,
    `--font-body: ${typography.body};`,
    `--font-heading-weight: ${typography.headingWeight};`,
    `--font-heading-tracking: ${typography.headingTracking};`,
  ];

  return vars.join("\n  ");
}

// Get all available color presets for UI selection
export function getColorPresetsList() {
  return Object.entries(COLOR_PRESETS).map(([key, value]) => ({
    id: key,
    ...value,
  }));
}

// Get all available typography pairings for UI selection
export function getTypographyPairingsList() {
  return Object.entries(TYPE_PAIRINGS).map(([key, value]) => ({
    id: key,
    ...value,
  }));
}

// Get all available website templates for UI selection
export function getWebsiteTemplatesList() {
  return Object.entries(WEBSITE_TEMPLATES).map(([key, value]) => ({
    id: key,
    ...value,
  }));
}

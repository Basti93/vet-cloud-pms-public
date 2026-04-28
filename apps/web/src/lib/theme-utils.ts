import { COLOR_PRESETS, TYPE_PAIRINGS, type ColorPresetKey, type TypographyPairingKey } from "./theme";

/**
 * Generate CSS variable styles from theme preferences.
 * Returns a React.CSSProperties object ready to apply as inline styles.
 */
export function generateThemeStyles(
  themePreference: string | null | undefined,
  typographyPreference: string | null | undefined
): React.CSSProperties {
  const colorKey = (themePreference as ColorPresetKey) || "sage";
  const typographyKey = (typographyPreference as TypographyPairingKey) || "modern";

  const preset = COLOR_PRESETS[colorKey] || COLOR_PRESETS.sage;
  const type = TYPE_PAIRINGS[typographyKey] || TYPE_PAIRINGS.modern;

  return {
    "--color-accent": preset.accent,
    "--color-accent-hover": preset.accentHover,
    "--color-accent-soft": preset.accentSoft,
    "--color-accent-text": preset.accentText,
    "--color-bg": preset.bg,
    "--color-surface": preset.surface,
    "--color-border": preset.border,
    "--color-border-strong": preset.borderStrong,
    "--color-fg": preset.fg,
    "--color-muted": preset.muted,
    "--color-muted-soft": preset.mutedSoft,
    "--font-heading": type.heading,
    "--font-body": type.body,
    "--font-heading-weight": String(type.headingWeight),
    "--font-heading-tracking": type.headingTracking,
  } as React.CSSProperties;
}

/**
 * Get the primary/accent color for inline component styles.
 * Useful when you need to apply color to individual components.
 */
export function getPrimaryColor(themePreference: string | null | undefined): string {
  const colorKey = (themePreference as ColorPresetKey) || "sage";
  return COLOR_PRESETS[colorKey]?.accent || COLOR_PRESETS.sage.accent;
}

/**
 * Get typography config for component-level styling.
 */
export function getTypography(typographyPreference: string | null | undefined) {
  const typographyKey = (typographyPreference as TypographyPairingKey) || "modern";
  return TYPE_PAIRINGS[typographyKey] || TYPE_PAIRINGS.modern;
}

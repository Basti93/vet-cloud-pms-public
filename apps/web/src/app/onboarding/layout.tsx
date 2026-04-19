import { ClerkProvider } from "@clerk/nextjs";
import {
  COLOR_PRESETS,
  TYPE_PAIRINGS,
  type ColorPresetKey,
  type TypographyPairingKey,
} from "@/lib/theme";
import { ReactNode } from "react";

// Use consistent sage brand colors (not tenant-specific, same as landing page)
const BRAND_PRESET = COLOR_PRESETS["sage" as ColorPresetKey];
const BRAND_TYPOGRAPHY = TYPE_PAIRINGS["modern" as TypographyPairingKey];

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  const themeStyle = {
    "--color-accent": BRAND_PRESET.accent,
    "--color-accent-hover": BRAND_PRESET.accentHover,
    "--color-accent-soft": BRAND_PRESET.accentSoft,
    "--color-accent-text": BRAND_PRESET.accentText,
    "--color-bg": BRAND_PRESET.bg,
    "--color-surface": BRAND_PRESET.surface,
    "--color-border": BRAND_PRESET.border,
    "--color-border-strong": BRAND_PRESET.borderStrong,
    "--color-fg": BRAND_PRESET.fg,
    "--color-muted": BRAND_PRESET.muted,
    "--color-muted-soft": BRAND_PRESET.mutedSoft,
    "--font-heading": BRAND_TYPOGRAPHY.heading,
    "--font-body": BRAND_TYPOGRAPHY.body,
    "--font-heading-weight": String(BRAND_TYPOGRAPHY.headingWeight),
    "--font-heading-tracking": BRAND_TYPOGRAPHY.headingTracking,
  } as React.CSSProperties;

  return (
    <ClerkProvider>
      <div style={themeStyle}>
        {children}
      </div>
    </ClerkProvider>
  );
}

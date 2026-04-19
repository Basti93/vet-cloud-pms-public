import { ClerkProvider } from "@clerk/nextjs";
import { db } from "@/lib/db/client";
import { tenants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  COLOR_PRESETS,
  TYPE_PAIRINGS,
  type ColorPresetKey,
  type TypographyPairingKey,
} from "@/lib/theme";
import { ReactNode } from "react";

export default async function OnboardingLayout({ children }: { children: ReactNode }) {
  const [demo] = await db
    .select({
      themePreference: tenants.themePreference,
      typographyPreference: tenants.typographyPreference,
    })
    .from(tenants)
    .where(eq(tenants.slug, "demo"))
    .limit(1);

  const preset = COLOR_PRESETS[(demo?.themePreference as ColorPresetKey) || "sage"];
  const type = TYPE_PAIRINGS[(demo?.typographyPreference as TypographyPairingKey) || "modern"];

  const themeStyle = {
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

  return (
    <ClerkProvider>
      <div style={themeStyle}>
        {children}
      </div>
    </ClerkProvider>
  );
}

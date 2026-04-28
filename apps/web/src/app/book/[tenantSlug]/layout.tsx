import { ReactNode } from "react";
import { db } from "@/lib/db/client";
import { tenants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { COLOR_PRESETS, TYPE_PAIRINGS, type ColorPresetKey, type TypographyPairingKey } from "@/lib/theme";

export default async function BookingLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  let themeStyle = {} as React.CSSProperties;

  // Load tenant theme from server
  const [tenant] = await db
    .select({
      themePreference: tenants.themePreference,
      typographyPreference: tenants.typographyPreference,
    })
    .from(tenants)
    .where(eq(tenants.slug, tenantSlug))
    .limit(1);

  // Apply theme if found
  if (tenant) {
    const preset = COLOR_PRESETS[(tenant.themePreference as ColorPresetKey) || "sage"];
    const type = TYPE_PAIRINGS[(tenant.typographyPreference as TypographyPairingKey) || "modern"];

    themeStyle = {
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
      "--primary": preset.accent,
    } as React.CSSProperties;
  } else {
    // Fallback: set --primary to default blue if tenant not found
    themeStyle = { "--primary": "#3B82F6" } as React.CSSProperties;
  }

  return (
    <div style={themeStyle}>
      {children}
    </div>
  );
}

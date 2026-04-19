import { ClerkProvider } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { ReactNode } from "react";
import { db } from "@/lib/db/client";
import { tenants, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  COLOR_PRESETS,
  TYPE_PAIRINGS,
  type ColorPresetKey,
  type TypographyPairingKey,
} from "@/lib/theme";
import DashboardContent from "./_layout-content";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { userId } = await auth();

  let themeStyle = {} as React.CSSProperties;

  // Try user → tenant lookup, fall back to demo tenant (mirrors tRPC getCurrent)
  let tenant: { themePreference: string | null; typographyPreference: string | null } | undefined;

  if (userId) {
    const [user] = await db
      .select({ tenantId: users.tenantId })
      .from(users)
      .where(eq(users.clerkId, userId))
      .limit(1);

    if (user) {
      const [found] = await db
        .select({
          themePreference: tenants.themePreference,
          typographyPreference: tenants.typographyPreference,
        })
        .from(tenants)
        .where(eq(tenants.id, user.tenantId))
        .limit(1);
      tenant = found;
    }
  }

  // No tenant found — fall back to default (globals.css sage theme)

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
    } as React.CSSProperties;
  }

  return (
    <ClerkProvider>
      <div style={themeStyle}>
        <DashboardContent>{children}</DashboardContent>
      </div>
    </ClerkProvider>
  );
}

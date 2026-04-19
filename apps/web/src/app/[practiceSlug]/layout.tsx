import { db } from '@/lib/db/client';
import { tenants } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import {
  COLOR_PRESETS,
  TYPE_PAIRINGS,
  type ColorPresetKey,
  type TypographyPairingKey,
} from '@/lib/theme';

interface Props {
  children: React.ReactNode;
  params: Promise<{ practiceSlug: string }>;
}

export default async function PracticeLayout({ children, params }: Props) {
  const { practiceSlug } = await params;

  const [tenant] = await db
    .select({
      themePreference: tenants.themePreference,
      typographyPreference: tenants.typographyPreference,
    })
    .from(tenants)
    .where(eq(tenants.slug, practiceSlug))
    .limit(1);

  const preset = tenant
    ? COLOR_PRESETS[(tenant.themePreference as ColorPresetKey) || 'sage']
    : COLOR_PRESETS.sage;
  const type = tenant
    ? TYPE_PAIRINGS[(tenant.typographyPreference as TypographyPairingKey) || 'modern']
    : TYPE_PAIRINGS.modern;

  const style = {
    '--color-accent': preset.accent,
    '--color-accent-hover': preset.accentHover,
    '--color-accent-soft': preset.accentSoft,
    '--color-accent-text': preset.accentText,
    '--color-bg': preset.bg,
    '--color-surface': preset.surface,
    '--color-border': preset.border,
    '--color-border-strong': preset.borderStrong,
    '--color-fg': preset.fg,
    '--color-muted': preset.muted,
    '--color-muted-soft': preset.mutedSoft,
    '--font-heading': type.heading,
    '--font-body': type.body,
    '--font-heading-weight': String(type.headingWeight),
    '--font-heading-tracking': type.headingTracking,
  } as React.CSSProperties;

  return <div style={style}>{children}</div>;
}

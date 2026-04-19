'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { generateCSSVariables, ColorPresetKey, TypographyPairingKey } from '@/lib/theme';
import { getTemplateComponent } from '@/lib/website-generator';
import { WebsiteTemplateKey } from '@/lib/theme';

export default function PracticeWebsitePage() {
  const params = useParams();
  const practiceSlug = params.practiceSlug as string;

  // Fetch tenant data
  const { data: tenant, isLoading } = trpc.tenant.getBySlug.useQuery(
    { slug: practiceSlug },
    { enabled: !!practiceSlug }
  );

  const [themeStyles, setThemeStyles] = useState<Record<string, string>>({});

  // Generate and inject CSS variables when tenant data loads
  useEffect(() => {
    if (tenant) {
      const cssVariables = generateCSSVariables(
        (tenant.themePreference as ColorPresetKey) || 'sage',
        (tenant.typographyPreference as TypographyPairingKey) || 'modern'
      );

      // Parse CSS variables into a style object
      const styles: Record<string, string> = {};
      cssVariables.split('\n').forEach((line) => {
        const [key, value] = line.replace(/;$/, '').split(':');
        if (key && value) {
          styles[key.trim()] = value.trim();
        }
      });
      setThemeStyles(styles);
    }
  }, [tenant]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg">
        <p className="text-muted">Laden...</p>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-fg mb-2">Praxis nicht gefunden</h1>
          <p className="text-muted">Die angeforderte Praxis existiert nicht.</p>
        </div>
      </div>
    );
  }

  // Get template component
  const TemplateComponent = getTemplateComponent(
    (tenant.websiteTemplate as WebsiteTemplateKey) || 'modern'
  );

  return (
    <div
      style={{
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
      } as React.CSSProperties}
    >
      <TemplateComponent
        brandName={tenant.name}
        tagline={tenant.tagline || ''}
        monogram={tenant.monogram || tenant.name.slice(0, 2).toUpperCase()}
        phone={tenant.phone || undefined}
        email={tenant.email || undefined}
        address={tenant.address || undefined}
        city={tenant.city || undefined}
      />
    </div>
  );
}

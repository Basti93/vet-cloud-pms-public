'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { trpc } from '@/lib/trpc/client';
import { BrandSettingsForm } from '@/components/brand/BrandSettingsForm';
import { BrandPreview } from '@/components/brand/BrandPreview';
import { ColorPresetKey, TypographyPairingKey, WebsiteTemplateKey } from '@/lib/theme';

export default function BrandBuilderPage() {
  const params = useParams();
  const tenantSlug = params.tenantSlug as string;
  const { userId, isSignedIn } = useAuth();

  const [colorPreset, setColorPreset] = useState<ColorPresetKey>('sage');
  const [typographyPairing, setTypographyPairing] = useState<TypographyPairingKey>('modern');
  const [template, setTemplate] = useState<WebsiteTemplateKey>('modern');
  const [brandName, setBrandName] = useState('');
  const [tagline, setTagline] = useState('');
  const [monogram, setMonogram] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Fetch tenant data
  const { data: tenant, isLoading } = trpc.tenant.getBySlug.useQuery(
    { slug: tenantSlug },
    { enabled: !!tenantSlug }
  );

  // Load tenant's current theme preferences
  useEffect(() => {
    if (tenant) {
      setColorPreset(tenant.themePreference as ColorPresetKey || 'sage');
      setTypographyPairing(tenant.typographyPreference as TypographyPairingKey || 'modern');
      setTemplate(tenant.websiteTemplate as WebsiteTemplateKey || 'modern');
      setBrandName(tenant.name || '');
      setTagline(tenant.tagline || '');
      setMonogram(tenant.monogram || '');
    }
  }, [tenant]);

  const handleSave = async () => {
    if (!isSignedIn || !userId) {
      // User needs to sign up to save
      // TODO: Redirect to sign-up with callback
      return;
    }

    setIsSaving(true);
    try {
      // TODO: Call API to save theme preferences
      // For now, just simulate success
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save preferences:', error);
    } finally {
      setIsSaving(false);
    }
  };

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

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <div className="bg-surface border-b border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-fg mb-2">Brand Builder</h1>
          <p className="text-muted">Passen Sie das Erscheinungsbild Ihrer Praxis an</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Settings Form */}
          <div>
            <BrandSettingsForm
              colorPreset={colorPreset}
              onColorPresetChange={setColorPreset}
              typographyPairing={typographyPairing}
              onTypographyPairingChange={setTypographyPairing}
              template={template}
              onTemplateChange={setTemplate}
              brandName={brandName}
              onBrandNameChange={setBrandName}
              tagline={tagline}
              onTaglineChange={setTagline}
              monogram={monogram}
              onMonogramChange={setMonogram}
              onSave={handleSave}
              isSaving={isSaving}
              canSave={isSignedIn ?? false}
              saveSuccess={saveSuccess}
            />
          </div>

          {/* Right: Live Preview */}
          <div>
            <BrandPreview
              colorPreset={colorPreset}
              typographyPairing={typographyPairing}
              template={template}
              brandName={brandName}
              tagline={tagline}
              monogram={monogram}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

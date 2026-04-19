"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import { BrandSettingsForm } from "@/components/brand/BrandSettingsForm";
import { BrandPreview } from "@/components/brand/BrandPreview";
import { ColorPresetKey, TypographyPairingKey, WebsiteTemplateKey } from "@/lib/theme";

export default function AppearancePage() {
  const [colorPreset, setColorPreset] = useState<ColorPresetKey>("sage");
  const [typographyPairing, setTypographyPairing] = useState<TypographyPairingKey>("modern");
  const [template, setTemplate] = useState<WebsiteTemplateKey>("modern");
  const [brandName, setBrandName] = useState("");
  const [tagline, setTagline] = useState("");
  const [monogram, setMonogram] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  const { data: tenant } = trpc.tenant.getCurrent.useQuery();

  const updateTheme = trpc.tenant.update.useMutation({
    onSuccess: () => {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
  });

  useEffect(() => {
    if (tenant) {
      setColorPreset((tenant.themePreference as ColorPresetKey) || "sage");
      setTypographyPairing((tenant.typographyPreference as TypographyPairingKey) || "modern");
      setBrandName(tenant.name || "");
      setTagline(tenant.tagline || "");
      setMonogram(tenant.monogram || "");
    }
  }, [tenant]);

  const handleSave = () => {
    updateTheme.mutate({
      name: brandName,
      tagline,
      monogram,
      themePreference: colorPreset,
      typographyPreference: typographyPairing,
      websiteTemplate: template,
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
        isSaving={updateTheme.isPending}
        canSave={true}
        saveSuccess={saveSuccess}
      />
      <BrandPreview
        colorPreset={colorPreset}
        typographyPairing={typographyPairing}
        template={template}
        brandName={brandName}
        tagline={tagline}
        monogram={monogram}
      />
    </div>
  );
}

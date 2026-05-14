"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import { useTheme } from "@/lib/theme-context";
import { BrandSettingsForm } from "@/components/brand/BrandSettingsForm";
import { BrandPreview } from "@/components/brand/BrandPreview";
import { ColorPresetKey, TypographyPairingKey } from "@/lib/theme";

export default function AppearancePage() {
  const { colorPreset, setColorPreset, typographyPairing, setTypographyPairing } = useTheme();
  const [localColorPreset, setLocalColorPreset] = useState<ColorPresetKey>(colorPreset);
  const [localTypographyPairing, setLocalTypographyPairing] = useState<TypographyPairingKey>(typographyPairing);
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
      const newColorPreset = (tenant.themePreference as ColorPresetKey) || "sage";
      const newTypographyPairing = (tenant.typographyPreference as TypographyPairingKey) || "modern";
      setLocalColorPreset(newColorPreset);
      setLocalTypographyPairing(newTypographyPairing);
      setColorPreset(newColorPreset);
      setTypographyPairing(newTypographyPairing);
    }
  }, [tenant, setColorPreset, setTypographyPairing]);

  const handleColorPresetChange = (preset: ColorPresetKey) => {
    setLocalColorPreset(preset);
    setColorPreset(preset);
  };

  const handleTypographyChange = (pairing: TypographyPairingKey) => {
    setLocalTypographyPairing(pairing);
    setTypographyPairing(pairing);
  };

  const handleSave = () => {
    updateTheme.mutate({
      themePreference: localColorPreset,
      typographyPreference: localTypographyPairing,
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <BrandSettingsForm
        colorPreset={localColorPreset}
        onColorPresetChange={handleColorPresetChange}
        typographyPairing={localTypographyPairing}
        onTypographyPairingChange={handleTypographyChange}
        showBrandingFields={false}
        onSave={handleSave}
        isSaving={updateTheme.isPending}
        canSave={true}
        saveSuccess={saveSuccess}
      />
      <BrandPreview
        colorPreset={localColorPreset}
        typographyPairing={localTypographyPairing}
        brandName={tenant?.name || "Tierarztpraxis"}
        tagline={tenant?.tagline || ""}
        monogram={tenant?.monogram || ""}
      />
    </div>
  );
}

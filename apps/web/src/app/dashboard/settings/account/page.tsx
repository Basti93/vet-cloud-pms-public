"use client";

import { useState } from "react";
import { useLocale } from "@/lib/locale/context";
import { locales } from "@/i18n.config";
import { Globe } from "lucide-react";
import { SelectField } from "@/components/forms/SelectField";
import { SettingsSection } from "@/components/forms/SettingsSection";
import { trpc } from "@/lib/trpc/client";
import { Card } from "@/components/ui/card";

const localeNames: Record<string, string> = {
  de: "Deutsch",
  en: "English",
};

export default function AccountPage() {
  const { locale, setLocale } = useLocale();
  const [localLocale, setLocalLocale] = useState(locale);
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [successMessage, setSuccessMessage] = useState<string | undefined>();

  const updateLocaleMutation = trpc.user.updateLocale.useMutation({
    onSuccess: () => {
      // Update the global locale context
      setLocale(localLocale);
      setIsDirty(false);
      setError(undefined);
      setSuccessMessage("Sprache erfolgreich gespeichert");
      // Hide success message after 3 seconds
      setTimeout(() => setSuccessMessage(undefined), 3000);
    },
    onError: (err) => {
      setError(err.message || "Fehler beim Speichern der Sprache");
    },
  });

  const handleLocaleChange = (newLocale: string) => {
    setLocalLocale(newLocale as "de" | "en");
    setIsDirty(true);
    setError(undefined);
    setSuccessMessage(undefined);
  };

  const handleSave = async () => {
    try {
      await updateLocaleMutation.mutateAsync({
        locale: localLocale as "de" | "en",
      });
    } catch {
      // Error is handled by mutation onError
    }
  };

  const handleReset = () => {
    setLocalLocale(locale);
    setIsDirty(false);
    setError(undefined);
    setSuccessMessage(undefined);
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Language Settings */}
      <SettingsSection
        title="Sprache"
        description="Wählen Sie die Sprache für Ihr Benutzererlebnis"
        icon={<Globe size={20} style={{ color: "var(--color-accent)" }} />}
        isDirty={isDirty}
        isLoading={updateLocaleMutation.isPending}
        error={error}
        successMessage={successMessage}
        onSave={handleSave}
        onReset={handleReset}
      >
        <SelectField
          label="Bevorzugte Sprache"
          value={localLocale}
          onChange={handleLocaleChange}
          options={locales.map((lang) => ({
            label: localeNames[lang],
            value: lang,
          }))}
        />
      </SettingsSection>

      {/* Placeholder for future features */}
      <Card className="p-6" style={{ borderColor: "var(--color-border)" }}>
        <h2 className="text-base font-semibold mb-2">Benutzerkonto</h2>
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>
          Weitere Kontooptionen wie Passwort, E-Mail-Adresse und Kontolöschung
          werden in Kürze hinzugefügt.
        </p>
      </Card>
    </div>
  );
}

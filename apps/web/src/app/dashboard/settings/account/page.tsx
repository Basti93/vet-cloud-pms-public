"use client";

import { useLocale } from "@/lib/locale/context";
import { locales } from "@/i18n.config";
import { Card } from "@/components/ui/card";
import { Globe } from "lucide-react";

const localeNames: Record<string, string> = {
  de: "Deutsch",
  en: "English",
};

export default function AccountPage() {
  const { locale, setLocale } = useLocale();

  return (
    <div className="max-w-2xl space-y-6">
      {/* Language Settings */}
      <Card className="p-6" style={{ borderColor: "var(--color-border)" }}>
        <div className="flex items-start gap-4">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: "var(--color-accent-soft)" }}
          >
            <Globe size={20} style={{ color: "var(--color-accent)" }} />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold mb-2">Sprache</h2>
            <p
              className="text-sm mb-4"
              style={{ color: "var(--color-muted)" }}
            >
              Wählen Sie die Sprache für Ihr Benutzererlebnis
            </p>
            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: "var(--color-fg)" }}
              >
                Bevorzugte Sprache
              </label>
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value as any)}
                className="px-3 py-2 rounded-lg border text-sm font-medium cursor-pointer"
                style={{
                  borderColor: "var(--color-border)",
                  backgroundColor: "var(--color-bg)",
                  color: "var(--color-fg)",
                }}
              >
                {locales.map((lang) => (
                  <option key={lang} value={lang}>
                    {localeNames[lang]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* Placeholder for future features */}
      <Card className="p-6" style={{ borderColor: "var(--color-border)" }}>
        <h2 className="text-base font-semibold mb-2">Benutzerkonto</h2>
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>
          Weitere Kontooptionen wie Passwort und Benutzerdaten werden in Kürze
          hinzugefügt.
        </p>
      </Card>
    </div>
  );
}

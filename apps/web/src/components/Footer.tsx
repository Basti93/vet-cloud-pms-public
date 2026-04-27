"use client";

import Link from "next/link";
import { useLanguage } from "@/i18n/LanguageContext";

const content = {
  de: {
    impressum: "Impressum",
    datenschutz: "Datenschutz",
    copyright: "© 2026 example.com",
  },
  en: {
    impressum: "Legal Notice",
    datenschutz: "Privacy Policy",
    copyright: "© 2026 example.com",
  },
};

export default function Footer() {
  const { lang } = useLanguage();
  const c = content[lang];

  return (
    <footer className="border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-[var(--text-muted)]">{c.copyright}</p>
          <div className="flex gap-6">
            <Link
              href="/impressum"
              className="text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--accent-blue)]"
            >
              {c.impressum}
            </Link>
            <Link
              href="/datenschutz"
              className="text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--accent-blue)]"
            >
              {c.datenschutz}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

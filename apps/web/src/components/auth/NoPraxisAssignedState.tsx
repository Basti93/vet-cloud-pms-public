"use client";

import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";
import { Building2, LogOut, LifeBuoy } from "lucide-react";

export function NoPraxisAssignedState({ supportEmail }: { supportEmail: string }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ backgroundColor: "var(--color-bg)", color: "var(--color-fg)" }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
        <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
          <Building2 size={20} />
        </div>

        <h1 className="text-2xl font-bold text-amber-900">Keine Praxis zugewiesen</h1>
        <p className="mt-3 text-sm text-amber-900">
          Ihr Benutzer ist angemeldet, aber aktuell keiner Praxis zugeordnet.
        </p>
        <p className="mt-2 text-sm text-amber-900">
          Sie können jetzt eine eigene Praxis anlegen oder den Support/System-Admin kontaktieren.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link
            href="/onboarding"
            className="inline-flex items-center justify-center rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-900 transition hover:bg-amber-100"
          >
            Praxis anlegen
          </Link>

          <a
            href={`mailto:${supportEmail}`}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-900 transition hover:bg-amber-100"
          >
            <LifeBuoy size={16} /> Support
          </a>

          <SignOutButton>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-900 transition hover:bg-amber-100 sm:col-span-2"
            >
              <LogOut size={16} /> Abmelden
            </button>
          </SignOutButton>
        </div>
      </div>
    </div>
  );
}

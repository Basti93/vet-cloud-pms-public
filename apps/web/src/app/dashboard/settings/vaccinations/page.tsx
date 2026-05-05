"use client";

import { useEffect, useState } from "react";
import { useTenant } from "@/hooks/useTenant";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/toast/context";
import { Skeleton } from "@/components/ui/skeleton";

export default function VaccinationSettingsPage() {
  const { tenantId } = useTenant();
  const utils = trpc.useUtils();
  const { addToast } = useToast();

  const { data, isLoading } = trpc.vaccinationSettings.get.useQuery(
    { tenantId: tenantId ?? "" },
    { enabled: !!tenantId }
  );

  const updateMutation = trpc.vaccinationSettings.update.useMutation({
    onSuccess: async () => {
      await utils.vaccinationSettings.get.invalidate();
      addToast("Einstellungen gespeichert.", "success");
    },
    onError: () => {
      addToast("Speichern fehlgeschlagen.", "error");
    },
  });

  const testMutation = trpc.vaccinationSettings.sendTestReminder.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        addToast("Test-E-Mail versendet.", "success");
      } else {
        addToast(`Fehler: ${data.error ?? "Unbekannter Fehler"}`, "error");
      }
    },
    onError: () => {
      addToast("Test-E-Mail konnte nicht gesendet werden.", "error");
    },
  });

  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderDaysBefore, setReminderDaysBefore] = useState(30);
  const [reminderSubject, setReminderSubject] = useState("Impf-Erinnerung für {petName}");
  const [reminderBody, setReminderBody] = useState("");
  const [testEmail, setTestEmail] = useState("");

  useEffect(() => {
    if (!data) return;
    setReminderEnabled(data.reminderEnabled);
    setReminderDaysBefore(data.reminderDaysBefore);
    setReminderSubject(data.reminderSubject);
    setReminderBody(data.reminderBody);
  }, [data]);

  if (!tenantId) {
    return <div className="text-muted">Tenant wird geladen ...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-fg">Impf-Erinnerungen</h2>
        <p className="mt-1 text-sm text-muted">
          Konfiguriere automatische Erinnerungen für fällige Auffrischungsimpfungen.
        </p>

        {isLoading ? (
          <div className="mt-4 space-y-4">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-10 w-28" />
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <label className="flex cursor-pointer items-center gap-3 text-sm text-fg">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--color-accent)]"
                checked={reminderEnabled}
                onChange={(e) => setReminderEnabled(e.target.checked)}
              />
              Impf-Erinnerungen aktivieren
            </label>

            <label className="block text-sm text-fg">
              Tage vor Fälligkeit
              <input
                type="number"
                min={1}
                max={365}
                className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-fg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                value={reminderDaysBefore}
                onChange={(e) => setReminderDaysBefore(Number(e.target.value))}
              />
            </label>

            <label className="block text-sm text-fg">
              Betreff
              <input
                className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-fg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                value={reminderSubject}
                onChange={(e) => setReminderSubject(e.target.value)}
              />
            </label>

            <label className="block text-sm text-fg">
              Nachricht
              <textarea
                className="mt-1 min-h-[180px] w-full rounded-lg border border-border bg-bg px-3 py-2 text-fg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                value={reminderBody}
                onChange={(e) => setReminderBody(e.target.value)}
              />
            </label>

            <p className="text-xs text-muted">
              Platzhalter: {"{ownerName}"}, {"{petName}"}, {"{vaccinationType}"}, {"{dueDate}"},{" "}
              {"{clinicName}"}, {"{bookingUrl}"}
            </p>

            <Button
              loading={updateMutation.isPending}
              onClick={() => {
                if (!tenantId) return;
                updateMutation.mutate({
                  tenantId,
                  reminderEnabled,
                  reminderDaysBefore,
                  reminderSubject,
                  reminderBody,
                });
              }}
            >
              Speichern
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <h3 className="text-base font-semibold text-fg">Test-Erinnerung senden</h3>
        <p className="mt-1 text-sm text-muted">
          Sende eine Test-E-Mail, um das Erinnerungsformat zu prüfen.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            placeholder="name@beispiel.de"
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
          />
          <Button
            variant="outline"
            loading={testMutation.isPending}
            disabled={!testEmail}
            onClick={() => {
              if (!tenantId) return;
              testMutation.mutate({ tenantId, emailAddress: testEmail });
            }}
          >
            Test senden
          </Button>
        </div>
      </div>
    </div>
  );
}

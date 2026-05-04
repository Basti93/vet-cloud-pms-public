"use client";

import { useEffect, useState } from "react";
import { useTenant } from "@/hooks/useTenant";
import { trpc } from "@/lib/trpc/client";

export default function VaccinationSettingsPage() {
  const { tenantId } = useTenant();
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.vaccinationSettings.get.useQuery(
    { tenantId: tenantId ?? "" },
    { enabled: !!tenantId }
  );

  const updateMutation = trpc.vaccinationSettings.update.useMutation({
    onSuccess: async () => {
      await utils.vaccinationSettings.get.invalidate();
    },
  });

  const testMutation = trpc.vaccinationSettings.sendTestReminder.useMutation();

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

  if (!tenantId) return <div>Tenant wird geladen ...</div>;
  if (isLoading) return <div>Lade Impfeinstellungen ...</div>;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Impf-Erinnerungen</h2>
        <p className="mt-1 text-sm text-gray-600">
          Konfiguriere automatische Erinnerungen für fällige Auffrischungsimpfungen.
        </p>

        <div className="mt-4 space-y-4">
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={reminderEnabled}
              onChange={(e) => setReminderEnabled(e.target.checked)}
            />
            Impf-Erinnerungen aktivieren
          </label>

          <label className="block text-sm">
            Tage vor Fälligkeit
            <input
              type="number"
              min={1}
              max={365}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
              value={reminderDaysBefore}
              onChange={(e) => setReminderDaysBefore(Number(e.target.value))}
            />
          </label>

          <label className="block text-sm">
            Betreff
            <input
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
              value={reminderSubject}
              onChange={(e) => setReminderSubject(e.target.value)}
            />
          </label>

          <label className="block text-sm">
            Nachricht
            <textarea
              className="mt-1 min-h-[180px] w-full rounded border border-gray-300 px-3 py-2"
              value={reminderBody}
              onChange={(e) => setReminderBody(e.target.value)}
            />
          </label>

          <div className="text-xs text-gray-500">
            Platzhalter: {"{ownerName}"}, {"{petName}"}, {"{vaccinationType}"}, {"{dueDate}"}, {"{clinicName}"}
          </div>

          <button
            className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
            disabled={updateMutation.isPending}
            onClick={() => {
              updateMutation.mutate({
                tenantId,
                reminderEnabled,
                reminderDaysBefore,
                reminderSubject,
                reminderBody,
              });
            }}
          >
            {updateMutation.isPending ? "Speichert ..." : "Speichern"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="text-base font-semibold">Test-Erinnerung senden</h3>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            placeholder="name@beispiel.de"
            className="w-full rounded border border-gray-300 px-3 py-2"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
          />
          <button
            className="rounded border border-gray-300 px-4 py-2"
            onClick={() => testMutation.mutate({ tenantId, emailAddress: testEmail })}
            disabled={testMutation.isPending || !testEmail}
          >
            Test senden
          </button>
        </div>
        {testMutation.data && (
          <p className="mt-2 text-sm">
            {testMutation.data.success ? "Test-E-Mail versendet." : `Fehler: ${testMutation.data.error}`}
          </p>
        )}
      </div>
    </div>
  );
}

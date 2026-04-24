'use client';

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc/client';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { Mail } from 'lucide-react';

export default function EmailSettingsPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get current tenant
  const tenant = trpc.tenant.getCurrent.useQuery(undefined, {
    onError: (err) => setError(`Tenant error: ${err.message}`),
  });

  // Get email settings with cache key to help with invalidation
  const utils = trpc.useUtils();
  const emailSettings = trpc.email.getSettings.useQuery(
    { tenantId: tenant.data?.id || '' },
    { enabled: !!tenant.data?.id, onError: (err) => setError(`Settings error: ${err.message}`) }
  );

  const updateSettingsMutation = trpc.email.updateSettings.useMutation({
    onSuccess: () => {
      // Invalidate the settings query to refetch
      utils.email.getSettings.invalidate({ tenantId: tenant.data?.id });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    },
    onError: (err) => setError(`Update error: ${err.message}`),
  });

  const testEmailMutation = trpc.email.sendTestEmail.useMutation({
    onSuccess: () => {
      setTestSuccess(true);
      setTestEmail('');
      setTimeout(() => setTestSuccess(false), 2000);
    },
    onError: (err) => setError(`Test email error: ${err.message}`),
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

  const loading = tenant.isLoading || emailSettings.isLoading;
  const settings = emailSettings.data;
  const isUpdating = updateSettingsMutation.isPending;

  const handleToggle = async (field: string, currentValue: boolean) => {
    if (!tenant.data?.id) return;
    setError(null);
    updateSettingsMutation.mutate({
      tenantId: tenant.data.id,
      [field]: !currentValue,
    });
  };

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <Mail className="w-8 h-8" style={{ color: 'var(--color-accent)' }} />
          <h1 className="text-3xl font-bold text-fg">E-Mail-Benachrichtigungen</h1>
        </div>
        <p className="text-muted">
          Konfigurieren Sie automatische E-Mail-Benachrichtigungen für Ihre Praxis.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-100 text-red-800 text-sm">
          ⚠️ {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--color-accent)' }}></div>
        </div>
      )}

      {saveSuccess && (
        <div className="p-4 rounded-lg bg-green-100 text-green-800 text-sm">
          ✓ Einstellungen gespeichert
        </div>
      )}

      {testSuccess && (
        <div className="p-4 rounded-lg bg-green-100 text-green-800 text-sm">
          ✓ Test-Email erfolgreich gesendet
        </div>
      )}

      {!loading && settings && (
        <>
          {/* Confirmation Emails */}
          <div className="bg-surface rounded-lg border border-[var(--color-border)] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-fg">Bestätigungsmails</h2>
                <p className="text-sm text-muted">E-Mails an Tierbesitzer nach Online-Terminanfrage</p>
              </div>
              <ToggleSwitch
                checked={settings.confirmationEmailEnabled}
                onChange={(checked) =>
                  handleToggle('confirmationEmailEnabled', !checked)
                }
                disabled={isUpdating}
              />
            </div>

            {settings.confirmationEmailEnabled && (
              <div className="space-y-4 border-t border-[var(--color-border)] pt-4">
                <div>
                  <label className="block text-sm font-medium text-fg mb-2">Betreff</label>
                  <input
                    type="text"
                    value={settings.confirmationSubject}
                    onChange={(e) => {
                      setError(null);
                      updateSettingsMutation.mutate({
                        tenantId: tenant.data!.id,
                        confirmationSubject: e.target.value,
                      });
                    }}
                    disabled={isUpdating}
                    className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-bg text-fg disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-fg mb-2">Nachricht</label>
                  <textarea
                    value={settings.confirmationBody}
                    onChange={(e) => {
                      setError(null);
                      updateSettingsMutation.mutate({
                        tenantId: tenant.data!.id,
                        confirmationBody: e.target.value,
                      });
                    }}
                    disabled={isUpdating}
                    rows={6}
                    className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-bg text-fg font-mono text-sm disabled:opacity-50"
                  />
                  <p className="text-xs text-muted mt-2">
                    Platzhalter: {'{practiceName}, {ownerFirstName}, {patientName}, {appointmentDateTime}'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Reminder Emails */}
          <div className="bg-surface rounded-lg border border-[var(--color-border)] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-fg">Erinnerungsmails</h2>
                <p className="text-sm text-muted">E-Mails an Tierbesitzer vor dem Termin</p>
              </div>
              <ToggleSwitch
                checked={settings.reminderEmailEnabled}
                onChange={(checked) =>
                  handleToggle('reminderEmailEnabled', !checked)
                }
                disabled={isUpdating}
              />
            </div>

            {settings.reminderEmailEnabled && (
              <div className="space-y-4 border-t border-[var(--color-border)] pt-4">
                <div>
                  <label className="block text-sm font-medium text-fg mb-2">
                    Erinnerung versenden vor (Stunden)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="168"
                    value={settings.reminderHoursBefore}
                    onChange={(e) => {
                      setError(null);
                      updateSettingsMutation.mutate({
                        tenantId: tenant.data!.id,
                        reminderHoursBefore: parseInt(e.target.value, 10),
                      });
                    }}
                    disabled={isUpdating}
                    className="w-32 px-3 py-2 border border-[var(--color-border)] rounded-lg bg-bg text-fg disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-fg mb-2">Betreff</label>
                  <input
                    type="text"
                    value={settings.reminderSubject}
                    onChange={(e) => {
                      setError(null);
                      updateSettingsMutation.mutate({
                        tenantId: tenant.data!.id,
                        reminderSubject: e.target.value,
                      });
                    }}
                    disabled={isUpdating}
                    className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-bg text-fg disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-fg mb-2">Nachricht</label>
                  <textarea
                    value={settings.reminderBody}
                    onChange={(e) => {
                      setError(null);
                      updateSettingsMutation.mutate({
                        tenantId: tenant.data!.id,
                        reminderBody: e.target.value,
                      });
                    }}
                    disabled={isUpdating}
                    rows={6}
                    className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-bg text-fg font-mono text-sm disabled:opacity-50"
                  />
                  <p className="text-xs text-muted mt-2">
                    Platzhalter: {'{practiceName}, {ownerFirstName}, {patientName}, {appointmentTime}'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Booking Notification Emails */}
          <div className="bg-surface rounded-lg border border-[var(--color-border)] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-fg">Benachrichtigungen für Praxis</h2>
                <p className="text-sm text-muted">E-Mails an Praxisteam bei neuen Terminanfragen</p>
              </div>
              <ToggleSwitch
                checked={settings.bookingNotificationEnabled}
                onChange={(checked) =>
                  handleToggle('bookingNotificationEnabled', !checked)
                }
                disabled={isUpdating}
              />
            </div>
          </div>

          {/* Test Email */}
          <div className="bg-surface rounded-lg border border-[var(--color-border)] p-6 space-y-4">
            <h3 className="text-lg font-bold text-fg">E-Mail testen</h3>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="test@example.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                disabled={testEmailMutation.isPending}
                className="flex-1 px-3 py-2 border border-[var(--color-border)] rounded-lg bg-bg text-fg disabled:opacity-50"
              />
              <button
                onClick={() => {
                  setError(null);
                  testEmailMutation.mutate({
                    tenantId: tenant.data!.id,
                    recipientEmail: testEmail,
                  });
                }}
                disabled={testEmailMutation.isPending}
                className="px-6 py-2 text-white rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-accent)' }}
              >
                {testEmailMutation.isPending ? 'Wird gesendet...' : 'Test senden'}
              </button>
            </div>
          </div>
        </>
      )}

      {!loading && !settings && !error && (
        <div className="p-4 rounded-lg bg-yellow-100 text-yellow-800 text-sm">
          Keine E-Mail-Einstellungen gefunden. Bitte versuchen Sie, die Seite zu aktualisieren.
        </div>
      )}
    </div>
  );
}

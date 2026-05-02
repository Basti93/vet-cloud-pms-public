'use client';

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc/client';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { Mail, AlertCircle } from 'lucide-react';

export default function EmailSettingsPage() {
  const FIXED_REMINDER_HOURS = 24;
  const [isMounted, setIsMounted] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);
  const [error, setError] = useState<string | undefined>();

  // Local state for form fields
  const [confirmationEmailEnabled, setConfirmationEmailEnabled] = useState(false);
  const [confirmationSubject, setConfirmationSubject] = useState('');
  const [confirmationBody, setConfirmationBody] = useState('');
  const [reminderEmailEnabled, setReminderEmailEnabled] = useState(false);
  const [reminderSubject, setReminderSubject] = useState('');
  const [reminderBody, setReminderBody] = useState('');
  const [bookingNotificationEnabled, setBookingNotificationEnabled] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Get current tenant
  const tenant = trpc.tenant.getCurrent.useQuery();

  // Get email settings with cache key to help with invalidation
  const utils = trpc.useUtils();
  const emailSettings = trpc.email.getSettings.useQuery(
    { tenantId: tenant.data?.id || '' },
    { enabled: !!tenant.data?.id }
  );

  // Initialize local state from fetched settings
  useEffect(() => {
    if (emailSettings.data) {
      setConfirmationEmailEnabled(emailSettings.data.confirmationEmailEnabled);
      setConfirmationSubject(emailSettings.data.confirmationSubject);
      setConfirmationBody(emailSettings.data.confirmationBody);
      setReminderEmailEnabled(emailSettings.data.reminderEmailEnabled);
      setReminderSubject(emailSettings.data.reminderSubject);
      setReminderBody(emailSettings.data.reminderBody);
      setBookingNotificationEnabled(emailSettings.data.bookingNotificationEnabled);
      setIsDirty(false);
    }
  }, [emailSettings.data]);

  const updateSettingsMutation = trpc.email.updateSettings.useMutation({
    onSuccess: () => {
      // Invalidate the settings query to refetch
      utils.email.getSettings.invalidate({ tenantId: tenant.data?.id });
      setIsDirty(false);
      setError(undefined);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
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

  const handleSave = async () => {
    if (!tenant.data?.id) return;
    setError(undefined);
    updateSettingsMutation.mutate({
      tenantId: tenant.data.id,
      confirmationEmailEnabled,
      confirmationSubject,
      confirmationBody,
      reminderEmailEnabled,
      reminderHoursBefore: FIXED_REMINDER_HOURS,
      reminderSubject,
      reminderBody,
      bookingNotificationEnabled,
    });
  };

  const handleReset = () => {
    if (emailSettings.data) {
      setConfirmationEmailEnabled(emailSettings.data.confirmationEmailEnabled);
      setConfirmationSubject(emailSettings.data.confirmationSubject);
      setConfirmationBody(emailSettings.data.confirmationBody);
      setReminderEmailEnabled(emailSettings.data.reminderEmailEnabled);
      setReminderSubject(emailSettings.data.reminderSubject);
      setReminderBody(emailSettings.data.reminderBody);
      setBookingNotificationEnabled(emailSettings.data.bookingNotificationEnabled);
      setIsDirty(false);
      setError(undefined);
      setSaveSuccess(false);
    }
  };

  const handleFieldChange = () => {
    setIsDirty(true);
    setError(undefined);
    setSaveSuccess(false);
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
        <div className="p-4 rounded-lg bg-red-100 text-red-800 text-sm flex items-center gap-2">
          <AlertCircle size={18} className="flex-shrink-0" />
          {error}
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
                checked={confirmationEmailEnabled}
                onChange={(checked) => {
                  setConfirmationEmailEnabled(checked);
                  handleFieldChange();
                }}
                disabled={isUpdating}
              />
            </div>

            {confirmationEmailEnabled && (
              <div className="space-y-4 border-t border-[var(--color-border)] pt-4">
                <div>
                  <label className="block text-sm font-medium text-fg mb-2">Betreff</label>
                  <input
                    type="text"
                    value={confirmationSubject}
                    onChange={(e) => {
                      setConfirmationSubject(e.target.value);
                      handleFieldChange();
                    }}
                    disabled={isUpdating}
                    className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-bg text-fg disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-fg mb-2">Nachricht</label>
                  <textarea
                    value={confirmationBody}
                    onChange={(e) => {
                      setConfirmationBody(e.target.value);
                      handleFieldChange();
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
                checked={reminderEmailEnabled}
                onChange={(checked) => {
                  setReminderEmailEnabled(checked);
                  handleFieldChange();
                }}
                disabled={isUpdating}
              />
            </div>

            {reminderEmailEnabled && (
              <div className="space-y-4 border-t border-[var(--color-border)] pt-4">
                <div>
                  <label className="block text-sm font-medium text-fg mb-2">
                    Erinnerung versenden vor (Stunden)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="168"
                    value={FIXED_REMINDER_HOURS}
                    disabled
                    readOnly
                    className="w-32 cursor-not-allowed px-3 py-2 border border-[var(--color-border)] rounded-lg bg-bg text-fg disabled:opacity-60"
                  />
                  <p className="mt-2 text-xs text-muted">
                    Vorübergehend fixiert auf 24h (Hobby-Cron kompatibel).
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-fg mb-2">Betreff</label>
                  <input
                    type="text"
                    value={reminderSubject}
                    onChange={(e) => {
                      setReminderSubject(e.target.value);
                      handleFieldChange();
                    }}
                    disabled={isUpdating}
                    className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-bg text-fg disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-fg mb-2">Nachricht</label>
                  <textarea
                    value={reminderBody}
                    onChange={(e) => {
                      setReminderBody(e.target.value);
                      handleFieldChange();
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
                checked={bookingNotificationEnabled}
                onChange={(checked) => {
                  setBookingNotificationEnabled(checked);
                  handleFieldChange();
                }}
                disabled={isUpdating}
              />
            </div>
          </div>

          {/* Save/Cancel buttons - only show when dirty */}
          {isDirty && (
            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={handleSave}
                disabled={isUpdating}
                className="px-6 py-2 text-white rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-accent)' }}
              >
                {isUpdating ? 'Wird gespeichert...' : 'Änderungen speichern'}
              </button>
              <button
                onClick={handleReset}
                disabled={isUpdating}
                className="px-6 py-2 rounded-lg font-medium border border-[var(--color-border)] hover:bg-surface transition disabled:opacity-50"
              >
                Abbrechen
              </button>
            </div>
          )}

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
                  setError(undefined);
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

export interface TrialExpiredAdminEmailInput {
  clinicName: string;
  adminEmail: string;
  adminDashboardUrl: string;
  contactAction?: string;
}

export async function sendTrialExpiredAdminEmail(
  input: TrialExpiredAdminEmailInput,
  sendFn: (params: {
    from: string;
    to: string;
    subject: string;
    text: string;
  }) => Promise<{ success: boolean; error?: unknown }>
) {
  const subject = `Testphase abgelaufen: ${input.clinicName}`;
  const body = `
Hallo,

Die 90-Tage Testphase für "${input.clinicName}" ist abgelaufen. Die Praxis wurde deaktiviert.

Weitere Schritte:
- Kontaktieren Sie den Klinikbetreiber und bieten Sie ein Abo an
- Alternativ können Sie die Praxis reaktivieren, falls ein Fehler vorliegen sollte
- Admin-Dashboard: ${input.adminDashboardUrl}

Bei Fragen kontaktieren Sie uns unter support@example.com

Mit freundlichen Grüßen,
Ihr Vet Cloud Team
  `.trim();

  return sendFn({
    from: "Vet Cloud <noreply@example.com>",
    to: input.adminEmail,
    subject,
    text: body,
  });
}

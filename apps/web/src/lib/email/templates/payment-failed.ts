export interface PaymentFailedEmailInput {
  clinicName: string;
  adminEmails: string[];
  gracePeriodEndsAt: Date;
  paymentMethodUpdateUrl: string;
}

export async function sendPaymentFailedAdminEmail(
  input: PaymentFailedEmailInput,
  sendFn: (params: {
    from: string;
    to: string;
    subject: string;
    text: string;
  }) => Promise<{ success: boolean; error?: unknown }>
) {
  const gracePeriodDate = input.gracePeriodEndsAt.toLocaleDateString("de-DE");
  const subject = `Zahlungsfehlgeschlagen: ${input.clinicName}`;
  const body = `
Hallo,

Zahlung für "${input.clinicName}" konnte nicht eingezogen werden.

Zahlungsdetails:
- Klinik: ${input.clinicName}
- Grace Period endet: ${gracePeriodDate}
- Danach wird die Praxis automatisch deaktiviert

Der Klinikbetreiber sollte seine Zahlungsmethode aktualisieren:
${input.paymentMethodUpdateUrl}

Bei Fragen kontaktieren Sie uns unter support@example.com

Mit freundlichen Grüßen,
Ihr Vet Cloud Team
  `.trim();

  return sendFn({
    from: "Vet Cloud <noreply@example.com>",
    to: input.adminEmails[0] || "",
    subject,
    text: body,
  });
}

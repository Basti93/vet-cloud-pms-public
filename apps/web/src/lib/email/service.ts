import { getEmailProvider } from "./providers";
import { emailTemplates, EmailPlaceholders } from "./templates";
import { renderVaccinationReminderEmail } from "./VaccinationReminderEmail";
import { renderVaccinationDigestEmail, type VaccinationDigestItem } from "./VaccinationDigestEmail";
import { getSystemDomain } from "@/lib/system-name";
import { db } from "@/lib/db/client";
import { emailLogs, type EmailType } from "@/lib/db/schema";

const provider = getEmailProvider();

const SYSTEM_DOMAIN = getSystemDomain();
const FROM_EMAIL = process.env.SMTP_FROM ?? "noreply@example.com";

function systemSender() {
  return `VetCloud <${FROM_EMAIL}>`;
}

function tenantSender(tenantName: string) {
  return `${tenantName} <${FROM_EMAIL}>`;
}

function getConsultationRecipient() {
  const recipient = process.env.CONSULTATION_RECIPIENT_EMAIL?.trim();
  if (!recipient) {
    throw new Error("Missing CONSULTATION_RECIPIENT_EMAIL environment variable");
  }
  return recipient;
}

async function logEmail(params: {
  tenantId?: string | null;
  emailType: EmailType;
  recipientEmail: string;
  status: "sent" | "failed";
  messageId?: string;
  errorMessage?: string;
}) {
  try {
    await db.insert(emailLogs).values({
      tenantId: params.tenantId ?? null,
      emailType: params.emailType,
      recipientEmail: params.recipientEmail,
      status: params.status,
      messageId: params.messageId ?? null,
      errorMessage: params.errorMessage ?? null,
    });
  } catch {
    // Never throw — email delivery takes priority over logging
  }
}

export interface SendConfirmationEmailInput {
  tenantId?: string;
  to: string;
  practiceName: string;
  ownerFirstName: string;
  patientName: string;
  patientSpecies: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentDateTime: string;
  vetName?: string;
}

export interface SendReminderEmailInput {
  tenantId?: string;
  to: string;
  practiceName: string;
  ownerFirstName: string;
  patientName: string;
  patientSpecies: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentDateTime: string;
  vetName?: string;
  customSubject?: string;
  customBody?: string;
}

export interface SendBookingNotificationInput {
  tenantId?: string;
  to: string;
  practiceName: string;
  ownerFirstName: string;
  ownerLastName: string;
  patientName: string;
  patientSpecies: string;
  appointmentDate: string;
  appointmentDateTime: string;
  vetName?: string;
}

export interface SendAccountDeletionEmailInput {
  to: string;
  confirmUrl: string;
  expiresAt: string;
}

export interface SendTenantDeactivationEmailInput {
  to: string;
  practiceName: string;
  scheduledFor: string;
  reactivateUrl: string;
}

export interface SendTenantLifecycleEmailInput {
  to: string;
  practiceName: string;
  subject: string;
  body: string;
}

export interface SendUserInvitationEmailInput {
  tenantId?: string;
  to: string;
  practiceName: string;
  role: "admin" | "vet" | "reception";
  acceptUrl: string;
  expiresAt: string;
}

export interface SendVaccinationReminderEmailInput {
  tenantId: string;
  vaccinationId: string;
  ownerEmail: string;
  ownerId?: string;
  ownerName: string;
  petName: string;
  vaccinationType: string;
  dueDate: Date;
  clinicName: string;
  bookingUrl?: string;
  unsubscribeUrl?: string;
  customSubject: string;
  customBody: string;
}

export interface SendConsultationRequestEmailInput {
  name: string;
  email: string;
  phone?: string;
  practiceName?: string;
  role?: string;
  websiteInterest?: boolean;
  message?: string;
}

function optionalValue(value: string | undefined) {
  return value && value.trim().length > 0 ? value.trim() : "Nicht angegeben";
}

export async function sendConsultationRequestEmail(input: SendConsultationRequestEmailInput) {
  const subject = `Neue Beratungsanfrage: ${input.practiceName || input.name}`;
  const text = `
Neue Beratungsanfrage über die Landingpage

Name: ${input.name}
E-Mail: ${input.email}
Telefon: ${optionalValue(input.phone)}
Praxis: ${optionalValue(input.practiceName)}
Rolle/Funktion: ${optionalValue(input.role)}
Website mitbuchen: ${input.websiteInterest ? "Ja" : "Nein / nicht angegeben"}

Nachricht:
${optionalValue(input.message)}
  `.trim();

  const recipient = getConsultationRecipient();
  try {
    const { messageId } = await provider.send({ from: systemSender(), to: recipient, subject, text });
    await logEmail({ emailType: "consultation_request", recipientEmail: recipient, status: "sent", messageId });
    return { success: true, messageId };
  } catch (error) {
    await logEmail({ emailType: "consultation_request", recipientEmail: recipient, status: "failed", errorMessage: String(error) });
    console.error("Error sending consultation request email:", error);
    return { success: false, error };
  }
}

export async function sendConfirmationEmail(input: SendConfirmationEmailInput) {
  const placeholders: EmailPlaceholders = {
    practiceName: input.practiceName,
    ownerFirstName: input.ownerFirstName,
    patientName: input.patientName,
    patientSpecies: input.patientSpecies,
    appointmentDate: input.appointmentDate,
    appointmentTime: input.appointmentTime,
    appointmentDateTime: input.appointmentDateTime,
    vetName: input.vetName || "Unser Team",
  };

  const text = emailTemplates.confirmation.render(emailTemplates.confirmation.defaultBody, placeholders);
  const subject = emailTemplates.confirmation.defaultSubject.replace("{practiceName}", input.practiceName);

  try {
    const { messageId } = await provider.send({ from: tenantSender(input.practiceName), to: input.to, subject, text });
    await logEmail({ tenantId: input.tenantId, emailType: "confirmation", recipientEmail: input.to, status: "sent", messageId });
    return { success: true, messageId };
  } catch (error) {
    await logEmail({ tenantId: input.tenantId, emailType: "confirmation", recipientEmail: input.to, status: "failed", errorMessage: String(error) });
    console.error("Error sending confirmation email:", error);
    return { success: false, error };
  }
}

export async function sendReminderEmail(input: SendReminderEmailInput) {
  const placeholders: EmailPlaceholders = {
    practiceName: input.practiceName,
    ownerFirstName: input.ownerFirstName,
    patientName: input.patientName,
    patientSpecies: input.patientSpecies,
    appointmentDate: input.appointmentDate,
    appointmentTime: input.appointmentTime,
    appointmentDateTime: input.appointmentDateTime,
    vetName: input.vetName || "Unser Team",
  };

  const bodyTemplate = input.customBody?.trim() || emailTemplates.reminder.defaultBody;
  const subjectTemplate = input.customSubject?.trim() || emailTemplates.reminder.defaultSubject;
  const text = emailTemplates.reminder.render(bodyTemplate, placeholders);
  const subject = emailTemplates.reminder.render(subjectTemplate, placeholders);

  try {
    const { messageId } = await provider.send({ from: tenantSender(input.practiceName), to: input.to, subject, text });
    await logEmail({ tenantId: input.tenantId, emailType: "reminder", recipientEmail: input.to, status: "sent", messageId });
    return { success: true, messageId };
  } catch (error) {
    await logEmail({ tenantId: input.tenantId, emailType: "reminder", recipientEmail: input.to, status: "failed", errorMessage: String(error) });
    console.error("Error sending reminder email:", error);
    return { success: false, error };
  }
}

export interface SendBookingRequestEmailInput {
  tenantId?: string;
  to: string;
  practiceName: string;
  ownerFirstName: string;
  patientName: string;
  patientSpecies: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentDateTime: string;
  confirmUrl: string;
  cancelUrl: string;
}

export async function sendBookingRequestEmail(input: SendBookingRequestEmailInput) {
  const text = `Hallo ${input.ownerFirstName},

Ihre Buchungsanfrage für ${input.patientName} (${input.patientSpecies}) am ${input.appointmentDateTime} bei ${input.practiceName} ist eingegangen.

Bitte bestätigen Sie Ihren Termin innerhalb von 24 Stunden:
${input.confirmUrl}

Wenn Sie diesen Termin nicht gebucht haben oder absagen möchten:
${input.cancelUrl}

Mit freundlichen Grüßen,
${input.practiceName}`;

  try {
    const { messageId } = await provider.send({
      from: tenantSender(input.practiceName),
      to: input.to,
      subject: `Terminanfrage bestätigen – ${input.practiceName}`,
      text,
    });
    await logEmail({ tenantId: input.tenantId, emailType: "booking_request", recipientEmail: input.to, status: "sent", messageId });
    return { success: true, messageId };
  } catch (error) {
    await logEmail({ tenantId: input.tenantId, emailType: "booking_request", recipientEmail: input.to, status: "failed", errorMessage: String(error) });
    console.error("Error sending booking request email:", error);
    return { success: false, error };
  }
}

export async function sendBookingNotificationEmail(input: SendBookingNotificationInput) {
  const placeholders: EmailPlaceholders = {
    practiceName: input.practiceName,
    ownerFirstName: input.ownerFirstName,
    ownerLastName: input.ownerLastName,
    patientName: input.patientName,
    patientSpecies: input.patientSpecies,
    appointmentDate: input.appointmentDate,
    appointmentTime: "",
    appointmentDateTime: input.appointmentDateTime,
    vetName: input.vetName || "Unzugewiesen",
  };

  const text = emailTemplates.bookingNotification.render(emailTemplates.bookingNotification.defaultBody, placeholders);
  const subject = emailTemplates.bookingNotification.defaultSubject
    .replace("{practiceName}", input.practiceName)
    .replace("{patientName}", input.patientName)
    .replace("{appointmentDate}", input.appointmentDate);

  try {
    const { messageId } = await provider.send({ from: systemSender(), to: input.to, subject, text });
    await logEmail({ tenantId: input.tenantId, emailType: "booking_notification", recipientEmail: input.to, status: "sent", messageId });
    return { success: true, messageId };
  } catch (error) {
    await logEmail({ tenantId: input.tenantId, emailType: "booking_notification", recipientEmail: input.to, status: "failed", errorMessage: String(error) });
    console.error("Error sending booking notification email:", error);
    return { success: false, error };
  }
}

export async function sendAccountDeletionEmail(input: SendAccountDeletionEmailInput) {
  const subject = "Bestätigung: Kontolöschung angefordert";
  const text = `
Hallo,

Sie haben eine Anfrage zum Löschen Ihres Kontos und aller damit verbundenen Daten gestellt.

Bitte bestätigen Sie die Kontolöschung, indem Sie auf den folgenden Link klicken:

${input.confirmUrl}

Dieser Link ist bis ${input.expiresAt} gültig.

Wenn Sie diese Anfrage nicht gestellt haben, ignorieren Sie diese Email und unternehmen Sie keine weiteren Maßnahmen. Ihr Konto wird nicht gelöscht.

WARNUNG: Nach der Bestätigung werden folgende Daten permanent gelöscht:
- Alle Praxisinformationen
- Alle Patientendaten und Tierakten
- Alle Termine und Terminhistorie
- Alle Benutzerkonten in dieser Praxis
- Alle E-Mail-Einstellungen und Vorlagen

Diese Aktion kann nicht rückgängig gemacht werden.

Mit freundlichen Grüßen,
Ihr ${SYSTEM_DOMAIN} Team
  `.trim();

  try {
    const { messageId } = await provider.send({ from: systemSender(), to: input.to, subject, text });
    await logEmail({ emailType: "account_deletion", recipientEmail: input.to, status: "sent", messageId });
    return { success: true, messageId };
  } catch (error) {
    await logEmail({ emailType: "account_deletion", recipientEmail: input.to, status: "failed", errorMessage: String(error) });
    console.error("Error sending account deletion email:", error);
    return { success: false, error };
  }
}

export async function sendTenantDeactivationEmail(input: SendTenantDeactivationEmailInput) {
  const subject = `Praxis deaktiviert: ${input.practiceName}`;
  const text = `
Hallo,

Ihre Praxis "${input.practiceName}" wurde deaktiviert und zur endgültigen Löschung vorgemerkt.

Geplantes Löschdatum: ${input.scheduledFor}

Wenn dies ein Versehen war, können Sie die Deaktivierung über folgenden Link rückgängig machen:
${input.reactivateUrl}

Nach dem Löschdatum werden alle Daten permanent entfernt.

Mit freundlichen Grüßen,
Ihr ${SYSTEM_DOMAIN} Team
  `.trim();

  try {
    const { messageId } = await provider.send({ from: systemSender(), to: input.to, subject, text });
    await logEmail({ emailType: "tenant_deactivation", recipientEmail: input.to, status: "sent", messageId });
    return { success: true, messageId };
  } catch (error) {
    await logEmail({ emailType: "tenant_deactivation", recipientEmail: input.to, status: "failed", errorMessage: String(error) });
    return { success: false, error };
  }
}

export async function sendTenantLifecycleEmail(input: SendTenantLifecycleEmailInput) {
  try {
    const { messageId } = await provider.send({ from: systemSender(), to: input.to, subject: input.subject, text: input.body });
    await logEmail({ emailType: "tenant_lifecycle", recipientEmail: input.to, status: "sent", messageId });
    return { success: true, messageId };
  } catch (error) {
    await logEmail({ emailType: "tenant_lifecycle", recipientEmail: input.to, status: "failed", errorMessage: String(error) });
    return { success: false, error };
  }
}

export async function sendUserInvitationEmail(input: SendUserInvitationEmailInput) {
  const roleLabel =
    input.role === "admin" ? "Administrator" : input.role === "vet" ? "Tierarzt" : "Empfang";

  const subject = `Einladung zu ${input.practiceName}`;
  const text = `
Hallo,

Sie wurden zu "${input.practiceName}" eingeladen.

Rolle: ${roleLabel}
Einladung akzeptieren: ${input.acceptUrl}
Gültig bis: ${input.expiresAt}

Wenn Sie diese Einladung nicht erwartet haben, ignorieren Sie diese E-Mail.

Mit freundlichen Grüßen,
Ihr ${SYSTEM_DOMAIN} Team
  `.trim();

  try {
    const { messageId } = await provider.send({ from: systemSender(), to: input.to, subject, text });
    await logEmail({ tenantId: input.tenantId, emailType: "invitation", recipientEmail: input.to, status: "sent", messageId });
    return { success: true, messageId };
  } catch (error) {
    await logEmail({ tenantId: input.tenantId, emailType: "invitation", recipientEmail: input.to, status: "failed", errorMessage: String(error) });
    return { success: false, error };
  }
}

export interface SendVaccinationDigestEmailInput {
  tenantId?: string;
  ownerEmail: string;
  ownerName: string;
  items: VaccinationDigestItem[];
  clinicName: string;
  bookingUrl?: string;
  unsubscribeUrl?: string;
}

export async function sendVaccinationDigestEmail(input: SendVaccinationDigestEmailInput) {
  const petNames = [...new Set(input.items.map((i) => i.petName))];
  const subject =
    petNames.length === 1
      ? `Impf-Erinnerung für ${petNames[0]}`
      : `Impf-Erinnerungen für ${petNames.slice(0, -1).join(", ")} und ${petNames[petNames.length - 1]}`;

  const html = renderVaccinationDigestEmail({
    ownerName: input.ownerName,
    items: input.items,
    clinicName: input.clinicName,
    bookingUrl: input.bookingUrl,
    unsubscribeUrl: input.unsubscribeUrl,
  });

  const text = [
    `Hallo ${input.ownerName},`,
    "",
    "folgende Impfungen sind demnächst fällig:",
    "",
    ...input.items.map((i) => `• ${i.petName}: ${i.vaccinationType} (${i.dueDate})`),
    "",
    `Bitte vereinbaren Sie einen Termin bei ${input.clinicName}.`,
    ...(input.bookingUrl ? ["", `Jetzt buchen: ${input.bookingUrl}`] : []),
  ].join("\n");

  try {
    const { messageId } = await provider.send({ from: tenantSender(input.clinicName), to: input.ownerEmail, subject, html, text });
    await logEmail({ tenantId: input.tenantId, emailType: "vaccination_digest", recipientEmail: input.ownerEmail, status: "sent", messageId });
    return { success: true, messageId };
  } catch (error) {
    await logEmail({ tenantId: input.tenantId, emailType: "vaccination_digest", recipientEmail: input.ownerEmail, status: "failed", errorMessage: String(error) });
    return { success: false, error };
  }
}

export async function sendVaccinationReminderEmail(input: SendVaccinationReminderEmailInput) {
  const dueDate = input.dueDate.toLocaleDateString("de-DE");

  const applyPlaceholders = (template: string) =>
    template
      .split("{ownerName}").join(input.ownerName)
      .split("{petName}").join(input.petName)
      .split("{vaccinationType}").join(input.vaccinationType)
      .split("{dueDate}").join(dueDate)
      .split("{clinicName}").join(input.clinicName)
      .split("{bookingUrl}").join(input.bookingUrl ?? "");

  const subject = applyPlaceholders(input.customSubject);
  const baseBody = applyPlaceholders(input.customBody);
  const text = input.bookingUrl && !input.customBody.includes("{bookingUrl}")
    ? `${baseBody}\n\nDirekt Termin buchen:\n${input.bookingUrl}`
    : baseBody;

  const html = renderVaccinationReminderEmail({
    ownerName: input.ownerName,
    petName: input.petName,
    vaccinationType: input.vaccinationType,
    dueDate,
    clinicName: input.clinicName,
    bookingUrl: input.bookingUrl,
    unsubscribeUrl: input.unsubscribeUrl,
  });

  try {
    const { messageId } = await provider.send({ from: tenantSender(input.clinicName), to: input.ownerEmail, subject, html, text });
    await logEmail({ tenantId: input.tenantId, emailType: "vaccination_reminder", recipientEmail: input.ownerEmail, status: "sent", messageId });
    return { success: true, messageId };
  } catch (error) {
    await logEmail({ tenantId: input.tenantId, emailType: "vaccination_reminder", recipientEmail: input.ownerEmail, status: "failed", errorMessage: String(error) });
    return { success: false, error };
  }
}

export async function sendPaymentFailedAdminEmail(input: {
  clinicName: string;
  adminEmails: string[];
  gracePeriodEndsAt: Date;
  stripePortalUrl?: string;
}) {
  const gracePeriodDate = input.gracePeriodEndsAt.toLocaleDateString("de-DE");
  const subject = `Zahlungsfehlgeschlagen: ${input.clinicName}`;
  const text = `
Hallo,

Zahlung für "${input.clinicName}" konnte nicht eingezogen werden.

Zahlungsdetails:
- Klinik: ${input.clinicName}
- Grace Period endet: ${gracePeriodDate}
- Danach wird die Praxis automatisch deaktiviert

Der Klinikbetreiber sollte seine Zahlungsmethode aktualisieren:
${input.stripePortalUrl || "Im Konto-Bereich unter Einstellungen"}

Bei Fragen kontaktieren Sie uns unter info@example.com

Mit freundlichen Grüßen,
Ihr Vet Cloud Team
  `.trim();

  const results = await Promise.allSettled(
    input.adminEmails.map(async (to) => {
      try {
        const { messageId } = await provider.send({ from: systemSender(), to, subject, text });
        await logEmail({ emailType: "payment_failed", recipientEmail: to, status: "sent", messageId });
        return { success: true, messageId };
      } catch (error) {
        await logEmail({ emailType: "payment_failed", recipientEmail: to, status: "failed", errorMessage: String(error) });
        throw error;
      }
    })
  );

  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length > 0) {
    console.error("Errors sending payment failed emails:", failed);
    return { success: false };
  }
  return { success: true };
}

export async function sendTrialExpiredAdminEmail(input: {
  clinicName: string;
  adminEmails: string[];
  adminDashboardUrl: string;
}) {
  const subject = `Testphase abgelaufen: ${input.clinicName}`;
  const text = `
Hallo,

Die 90-Tage Testphase für "${input.clinicName}" ist abgelaufen. Die Praxis wurde deaktiviert.

Weitere Schritte:
- Kontaktieren Sie den Klinikbetreiber und bieten Sie ein Abo an
- Alternativ können Sie die Praxis reaktivieren, falls ein Fehler vorliegen sollte
- Admin-Dashboard: ${input.adminDashboardUrl}

Bei Fragen kontaktieren Sie uns unter info@example.com

Mit freundlichen Grüßen,
Ihr Vet Cloud Team
  `.trim();

  const results = await Promise.allSettled(
    input.adminEmails.map(async (to) => {
      try {
        const { messageId } = await provider.send({ from: systemSender(), to, subject, text });
        await logEmail({ emailType: "trial_expired", recipientEmail: to, status: "sent", messageId });
        return { success: true, messageId };
      } catch (error) {
        await logEmail({ emailType: "trial_expired", recipientEmail: to, status: "failed", errorMessage: String(error) });
        throw error;
      }
    })
  );

  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length > 0) {
    console.error("Errors sending trial expired emails:", failed);
    return { success: false };
  }
  return { success: true };
}

export async function sendTrialEndingEmail(input: {
  clinicEmail: string;
  clinicName: string;
  billingUrl: string;
}) {
  const subject = "Deine Testphase endet bald";
  const mainDomain = getSystemDomain();
  const text = `
Hallo ${input.clinicName},

Deine kostenlosen 3 Monate enden bald. Nach dieser Zeit müssen Sie sich für einen Tarif anmelden, um Zugriff auf Vet Cloud zu behalten.

Verfügbare Tarife:
- 1 Nutzer: €30/Monat
- 3 Nutzer: €50/Monat
- 5 Nutzer: €100/Monat
- 10 Nutzer: €200/Monat

Jetzt upgraden: ${mainDomain}${input.billingUrl}

Ohne ein aktives Abo wird Ihre Klinik deaktiviert und nach 30 Tagen gelöscht.

Bei Fragen schreiben Sie uns: info@example.com

Mit freundlichen Grüßen,
Ihr Vet Cloud Team
  `.trim();

  try {
    const { messageId } = await provider.send({ from: systemSender(), to: input.clinicEmail, subject, text });
    await logEmail({ emailType: "trial_ending", recipientEmail: input.clinicEmail, status: "sent", messageId });
    return { success: true, messageId };
  } catch (error) {
    await logEmail({ emailType: "trial_ending", recipientEmail: input.clinicEmail, status: "failed", errorMessage: String(error) });
    return { success: false, error };
  }
}

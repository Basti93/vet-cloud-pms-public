import { getEmailProvider, getProviderForTenant } from "./providers";
import { emailTemplates, EmailPlaceholders } from "./templates";
import { renderVaccinationReminderEmail } from "./VaccinationReminderEmail";
import { renderVaccinationDigestEmail, type VaccinationDigestItem } from "./VaccinationDigestEmail";
import { getSystemDomain } from "@/lib/system-name";
import { db } from "@/lib/db/client";
import { emailLogs, type EmailType } from "@/lib/db/schema";
import type { EmailProvider } from "./types";

const systemProvider = getEmailProvider();
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

// ─── Dispatch ─────────────────────────────────────────────────────────────────

export interface TemplateResult {
  to: string;
  subject: string;
  text: string;
  html?: string;
  emailType: EmailType;
  tenantId?: string;
  /** "tenant" = resolve via getProviderForTenant (may use custom SMTP); "system" = always system SMTP */
  providerKind: "tenant" | "system";
  /** Fallback display name for the "from" header on tenant emails */
  tenantName?: string;
}

/**
 * Central send path. `build` is called inside the try/catch so builder errors
 * (e.g. missing env vars) are caught and returned as `{ success: false }`.
 * Pass `injectedProvider` in tests to skip all DB/SMTP calls.
 */
export async function dispatch(
  build: () => TemplateResult,
  injectedProvider?: EmailProvider
): Promise<{ success: boolean; messageId?: string; error?: unknown }> {
  let template: TemplateResult | undefined;
  try {
    template = build();

    let provider: EmailProvider;
    let from: string;

    if (injectedProvider) {
      provider = injectedProvider;
      from =
        template.providerKind === "tenant" && template.tenantName
          ? tenantSender(template.tenantName)
          : systemSender();
    } else if (template.providerKind === "tenant") {
      const resolved = await getProviderForTenant(template.tenantId);
      provider = resolved.provider;
      from = resolved.from ?? (template.tenantName ? tenantSender(template.tenantName) : systemSender());
    } else {
      provider = systemProvider;
      from = systemSender();
    }

    const { messageId } = await provider.send({
      from,
      to: template.to,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });

    await logEmail({
      tenantId: template.tenantId,
      emailType: template.emailType,
      recipientEmail: template.to,
      status: "sent",
      messageId,
    });

    return { success: true, messageId };
  } catch (error) {
    if (template) {
      await logEmail({
        tenantId: template.tenantId,
        emailType: template.emailType,
        recipientEmail: template.to,
        status: "failed",
        errorMessage: String(error),
      });
    }
    console.error("Error dispatching email:", error);
    return { success: false, error };
  }
}

// ─── Input interfaces ─────────────────────────────────────────────────────────

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

export interface SendVaccinationDigestEmailInput {
  tenantId?: string;
  ownerEmail: string;
  ownerName: string;
  items: VaccinationDigestItem[];
  clinicName: string;
  bookingUrl?: string;
  unsubscribeUrl?: string;
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

// ─── Template builders ────────────────────────────────────────────────────────

function optionalValue(value: string | undefined) {
  return value && value.trim().length > 0 ? value.trim() : "Nicht angegeben";
}

function buildConfirmationEmail(input: SendConfirmationEmailInput): TemplateResult {
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
  return {
    to: input.to,
    subject: emailTemplates.confirmation.defaultSubject.replace("{practiceName}", input.practiceName),
    text: emailTemplates.confirmation.render(emailTemplates.confirmation.defaultBody, placeholders),
    emailType: "confirmation",
    tenantId: input.tenantId,
    providerKind: "tenant",
    tenantName: input.practiceName,
  };
}

function buildReminderEmail(input: SendReminderEmailInput): TemplateResult {
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
  return {
    to: input.to,
    subject: emailTemplates.reminder.render(subjectTemplate, placeholders),
    text: emailTemplates.reminder.render(bodyTemplate, placeholders),
    emailType: "reminder",
    tenantId: input.tenantId,
    providerKind: "tenant",
    tenantName: input.practiceName,
  };
}

function buildBookingRequestEmail(input: SendBookingRequestEmailInput): TemplateResult {
  return {
    to: input.to,
    subject: `Terminanfrage bestätigen – ${input.practiceName}`,
    text: `Hallo ${input.ownerFirstName},

Ihre Buchungsanfrage für ${input.patientName} (${input.patientSpecies}) am ${input.appointmentDateTime} bei ${input.practiceName} ist eingegangen.

Bitte bestätigen Sie Ihren Termin innerhalb von 24 Stunden:
${input.confirmUrl}

Wenn Sie diesen Termin nicht gebucht haben oder absagen möchten:
${input.cancelUrl}

Mit freundlichen Grüßen,
${input.practiceName}`,
    emailType: "booking_request",
    tenantId: input.tenantId,
    providerKind: "tenant",
    tenantName: input.practiceName,
  };
}

function buildBookingNotificationEmail(input: SendBookingNotificationInput): TemplateResult {
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
  return {
    to: input.to,
    subject: emailTemplates.bookingNotification.defaultSubject
      .replace("{practiceName}", input.practiceName)
      .replace("{patientName}", input.patientName)
      .replace("{appointmentDate}", input.appointmentDate),
    text: emailTemplates.bookingNotification.render(emailTemplates.bookingNotification.defaultBody, placeholders),
    emailType: "booking_notification",
    tenantId: input.tenantId,
    providerKind: "system",
  };
}

function buildAccountDeletionEmail(input: SendAccountDeletionEmailInput): TemplateResult {
  return {
    to: input.to,
    subject: "Bestätigung: Kontolöschung angefordert",
    text: `Hallo,

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
Ihr ${SYSTEM_DOMAIN} Team`,
    emailType: "account_deletion",
    providerKind: "system",
  };
}

function buildTenantDeactivationEmail(input: SendTenantDeactivationEmailInput): TemplateResult {
  return {
    to: input.to,
    subject: `Praxis deaktiviert: ${input.practiceName}`,
    text: `Hallo,

Ihre Praxis "${input.practiceName}" wurde deaktiviert und zur endgültigen Löschung vorgemerkt.

Geplantes Löschdatum: ${input.scheduledFor}

Wenn dies ein Versehen war, können Sie die Deaktivierung über folgenden Link rückgängig machen:
${input.reactivateUrl}

Nach dem Löschdatum werden alle Daten permanent entfernt.

Mit freundlichen Grüßen,
Ihr ${SYSTEM_DOMAIN} Team`,
    emailType: "tenant_deactivation",
    providerKind: "system",
  };
}

function buildTenantLifecycleEmail(input: SendTenantLifecycleEmailInput): TemplateResult {
  return {
    to: input.to,
    subject: input.subject,
    text: input.body,
    emailType: "tenant_lifecycle",
    providerKind: "system",
  };
}

function buildUserInvitationEmail(input: SendUserInvitationEmailInput): TemplateResult {
  const roleLabel =
    input.role === "admin" ? "Administrator" : input.role === "vet" ? "Tierarzt" : "Empfang";
  return {
    to: input.to,
    subject: `Einladung zu ${input.practiceName}`,
    text: `Hallo,

Sie wurden zu "${input.practiceName}" eingeladen.

Rolle: ${roleLabel}
Einladung akzeptieren: ${input.acceptUrl}
Gültig bis: ${input.expiresAt}

Wenn Sie diese Einladung nicht erwartet haben, ignorieren Sie diese E-Mail.

Mit freundlichen Grüßen,
Ihr ${SYSTEM_DOMAIN} Team`,
    emailType: "invitation",
    tenantId: input.tenantId,
    providerKind: "system",
  };
}

function buildVaccinationDigestEmail(input: SendVaccinationDigestEmailInput): TemplateResult {
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

  return {
    to: input.ownerEmail,
    subject,
    text,
    html,
    emailType: "vaccination_digest",
    tenantId: input.tenantId,
    providerKind: "tenant",
    tenantName: input.clinicName,
  };
}

function buildVaccinationReminderEmail(input: SendVaccinationReminderEmailInput): TemplateResult {
  const dueDate = input.dueDate.toLocaleDateString("de-DE");

  const applyPlaceholders = (template: string) =>
    template
      .split("{ownerName}").join(input.ownerName)
      .split("{petName}").join(input.petName)
      .split("{vaccinationType}").join(input.vaccinationType)
      .split("{dueDate}").join(dueDate)
      .split("{clinicName}").join(input.clinicName)
      .split("{bookingUrl}").join(input.bookingUrl ?? "");

  const baseBody = applyPlaceholders(input.customBody);
  const text =
    input.bookingUrl && !input.customBody.includes("{bookingUrl}")
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

  return {
    to: input.ownerEmail,
    subject: applyPlaceholders(input.customSubject),
    text,
    html,
    emailType: "vaccination_reminder",
    tenantId: input.tenantId,
    providerKind: "tenant",
    tenantName: input.clinicName,
  };
}

function buildConsultationRequestEmail(input: SendConsultationRequestEmailInput): TemplateResult {
  const recipient = getConsultationRecipient();
  return {
    to: recipient,
    subject: `Neue Beratungsanfrage: ${input.practiceName || input.name}`,
    text: `Neue Beratungsanfrage über die Landingpage

Name: ${input.name}
E-Mail: ${input.email}
Telefon: ${optionalValue(input.phone)}
Praxis: ${optionalValue(input.practiceName)}
Rolle/Funktion: ${optionalValue(input.role)}
Website mitbuchen: ${input.websiteInterest ? "Ja" : "Nein / nicht angegeben"}

Nachricht:
${optionalValue(input.message)}`,
    emailType: "consultation_request",
    providerKind: "system",
  };
}

// ─── Named exports ────────────────────────────────────────────────────────────

export const sendConfirmationEmail = (input: SendConfirmationEmailInput) =>
  dispatch(() => buildConfirmationEmail(input));

export const sendReminderEmail = (input: SendReminderEmailInput) =>
  dispatch(() => buildReminderEmail(input));

export const sendBookingRequestEmail = (input: SendBookingRequestEmailInput) =>
  dispatch(() => buildBookingRequestEmail(input));

export const sendBookingNotificationEmail = (input: SendBookingNotificationInput) =>
  dispatch(() => buildBookingNotificationEmail(input));

export const sendAccountDeletionEmail = (input: SendAccountDeletionEmailInput) =>
  dispatch(() => buildAccountDeletionEmail(input));

export const sendTenantDeactivationEmail = (input: SendTenantDeactivationEmailInput) =>
  dispatch(() => buildTenantDeactivationEmail(input));

export const sendTenantLifecycleEmail = (input: SendTenantLifecycleEmailInput) =>
  dispatch(() => buildTenantLifecycleEmail(input));

export const sendUserInvitationEmail = (input: SendUserInvitationEmailInput) =>
  dispatch(() => buildUserInvitationEmail(input));

export const sendVaccinationDigestEmail = (input: SendVaccinationDigestEmailInput) =>
  dispatch(() => buildVaccinationDigestEmail(input));

export const sendVaccinationReminderEmail = (input: SendVaccinationReminderEmailInput) =>
  dispatch(() => buildVaccinationReminderEmail(input));

export const sendConsultationRequestEmail = (input: SendConsultationRequestEmailInput) =>
  dispatch(() => buildConsultationRequestEmail(input));

// ─── Multi-recipient functions ────────────────────────────────────────────────

export async function sendPaymentFailedAdminEmail(input: {
  clinicName: string;
  adminEmails: string[];
  gracePeriodEndsAt: Date;
  stripePortalUrl?: string;
}) {
  const gracePeriodDate = input.gracePeriodEndsAt.toLocaleDateString("de-DE");
  const results = await Promise.allSettled(
    input.adminEmails.map(async (to) => {
      const result = await dispatch(() => ({
        to,
        subject: `Zahlungsfehlgeschlagen: ${input.clinicName}`,
        text: `Hallo,

Zahlung für "${input.clinicName}" konnte nicht eingezogen werden.

Zahlungsdetails:
- Klinik: ${input.clinicName}
- Grace Period endet: ${gracePeriodDate}
- Danach wird die Praxis automatisch deaktiviert

Der Klinikbetreiber sollte seine Zahlungsmethode aktualisieren:
${input.stripePortalUrl || "Im Konto-Bereich unter Einstellungen"}

Bei Fragen kontaktieren Sie uns unter info@example.com

Mit freundlichen Grüßen,
Ihr Vet Cloud Team`,
        emailType: "payment_failed" as EmailType,
        providerKind: "system" as const,
      }));
      if (!result.success) throw result.error;
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
  const results = await Promise.allSettled(
    input.adminEmails.map(async (to) => {
      const result = await dispatch(() => ({
        to,
        subject: `Testphase abgelaufen: ${input.clinicName}`,
        text: `Hallo,

Die 90-Tage Testphase für "${input.clinicName}" ist abgelaufen. Die Praxis wurde deaktiviert.

Weitere Schritte:
- Kontaktieren Sie den Klinikbetreiber und bieten Sie ein Abo an
- Alternativ können Sie die Praxis reaktivieren, falls ein Fehler vorliegen sollte
- Admin-Dashboard: ${input.adminDashboardUrl}

Bei Fragen kontaktieren Sie uns unter info@example.com

Mit freundlichen Grüßen,
Ihr Vet Cloud Team`,
        emailType: "trial_expired" as EmailType,
        providerKind: "system" as const,
      }));
      if (!result.success) throw result.error;
    })
  );
  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length > 0) {
    console.error("Errors sending trial expired emails:", failed);
    return { success: false };
  }
  return { success: true };
}

export const sendTrialEndingEmail = (input: {
  clinicEmail: string;
  clinicName: string;
  billingUrl: string;
}) => {
  const mainDomain = getSystemDomain();
  return dispatch(() => ({
    to: input.clinicEmail,
    subject: "Deine Testphase endet bald",
    text: `Hallo ${input.clinicName},

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
Ihr Vet Cloud Team`,
    emailType: "trial_ending" as EmailType,
    providerKind: "system" as const,
  }));
};

import { Resend } from "resend";
import { emailTemplates, EmailPlaceholders } from "./templates";
import { renderVaccinationReminderEmail } from "./VaccinationReminderEmail";
import { renderVaccinationDigestEmail, type VaccinationDigestItem } from "./VaccinationDigestEmail";
import { getSystemDomain } from "@/lib/system-name";

// Lazy — safe to import during Next.js static page generation without RESEND_API_KEY.
let _resend: Resend | undefined;
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

const SYSTEM_DOMAIN = getSystemDomain();

// Use configured FROM_EMAIL or default to Resend's onboarding domain for testing
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

function systemSender() {
  return `${SYSTEM_DOMAIN} <${FROM_EMAIL}>`;
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

export interface SendConfirmationEmailInput {
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
  const body = `
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

  try {
    const result = await getResend().emails.send({
      from: systemSender(),
      to: getConsultationRecipient(),
      subject,
      text: body,
    });

    if (result.error) {
      console.error("Resend error:", result.error);
      return { success: false, error: result.error };
    }

    return { success: true, messageId: result.data?.id };
  } catch (error) {
    console.error("Error sending consultation request email:", error);
    return { success: false, error };
  }
}

/**
 * Send appointment confirmation email to patient owner
 */
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

  const body = emailTemplates.confirmation.render(
    emailTemplates.confirmation.defaultBody,
    placeholders
  );

  const subject = emailTemplates.confirmation.defaultSubject
    .replace("{practiceName}", input.practiceName);

  try {
    const result = await getResend().emails.send({
      from: tenantSender(input.practiceName),
      to: input.to,
      subject,
      text: body,
    });

    if (result.error) {
      console.error("Resend error:", result.error);
      return { success: false, error: result.error };
    }

    return { success: true, messageId: result.data?.id };
  } catch (error) {
    console.error("Error sending confirmation email:", error);
    return { success: false, error };
  }
}

/**
 * Send appointment reminder email to patient owner
 */
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
  const subjectTemplate =
    input.customSubject?.trim() || emailTemplates.reminder.defaultSubject;
  const body = emailTemplates.reminder.render(bodyTemplate, placeholders);
  const subject = emailTemplates.reminder.render(subjectTemplate, placeholders);

  try {
    const result = await getResend().emails.send({
      from: tenantSender(input.practiceName),
      to: input.to,
      subject,
      text: body,
    });

    if (result.error) {
      console.error("Resend error:", result.error);
      return { success: false, error: result.error };
    }

    return { success: true, messageId: result.data?.id };
  } catch (error) {
    console.error("Error sending reminder email:", error);
    return { success: false, error };
  }
}

export interface SendBookingRequestEmailInput {
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

/**
 * Send booking confirmation request to patient owner (online booking — email verification step)
 */
export async function sendBookingRequestEmail(input: SendBookingRequestEmailInput) {
  const body = `Hallo ${input.ownerFirstName},

Ihre Buchungsanfrage für ${input.patientName} (${input.patientSpecies}) am ${input.appointmentDateTime} bei ${input.practiceName} ist eingegangen.

Bitte bestätigen Sie Ihren Termin innerhalb von 24 Stunden:
${input.confirmUrl}

Wenn Sie diesen Termin nicht gebucht haben oder absagen möchten:
${input.cancelUrl}

Mit freundlichen Grüßen,
${input.practiceName}`;

  try {
    const result = await getResend().emails.send({
      from: tenantSender(input.practiceName),
      to: input.to,
      subject: `Terminanfrage bestätigen – ${input.practiceName}`,
      text: body,
    });

    if (result.error) {
      console.error("Resend error:", result.error);
      return { success: false, error: result.error };
    }

    return { success: true, messageId: result.data?.id };
  } catch (error) {
    console.error("Error sending booking request email:", error);
    return { success: false, error };
  }
}

/**
 * Send booking notification to practice owner
 */
export async function sendBookingNotificationEmail(input: SendBookingNotificationInput) {
  const placeholders: EmailPlaceholders = {
    practiceName: input.practiceName,
    ownerFirstName: input.ownerFirstName,
    ownerLastName: input.ownerLastName,
    patientName: input.patientName,
    patientSpecies: input.patientSpecies,
    appointmentDate: input.appointmentDate,
    appointmentTime: "", // Not in booking notification
    appointmentDateTime: input.appointmentDateTime,
    vetName: input.vetName || "Unzugewiesen",
  };

  const body = emailTemplates.bookingNotification.render(
    emailTemplates.bookingNotification.defaultBody,
    placeholders
  );

  const subject = emailTemplates.bookingNotification.defaultSubject
    .replace("{practiceName}", input.practiceName)
    .replace("{patientName}", input.patientName)
    .replace("{appointmentDate}", input.appointmentDate);

  try {
    const result = await getResend().emails.send({
      from: systemSender(),
      to: input.to,
      subject,
      text: body,
    });

    if (result.error) {
      console.error("Resend error:", result.error);
      return { success: false, error: result.error };
    }

    return { success: true, messageId: result.data?.id };
  } catch (error) {
    console.error("Error sending booking notification:", error);
    return { success: false, error };
  }
}

/**
 * Send account deletion confirmation email
 * DSGVO Art. 17 - Right to erasure
 */
export async function sendAccountDeletionEmail(input: SendAccountDeletionEmailInput) {
  const subject = "Bestätigung: Kontolöschung angefordert";

  const body = `
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
    const result = await getResend().emails.send({
      from: systemSender(),
      to: input.to,
      subject,
      text: body,
    });

    if (result.error) {
      console.error("Resend error:", result.error);
      return { success: false, error: result.error };
    }

    return { success: true, messageId: result.data?.id };
  } catch (error) {
    console.error("Error sending account deletion email:", error);
    return { success: false, error };
  }
}

export async function sendTenantDeactivationEmail(
  input: SendTenantDeactivationEmailInput
) {
  const subject = `Praxis deaktiviert: ${input.practiceName}`;
  const body = `
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
    const result = await getResend().emails.send({
      from: systemSender(),
      to: input.to,
      subject,
      text: body,
    });
    if (result.error) {
      return { success: false, error: result.error };
    }
    return { success: true, messageId: result.data?.id };
  } catch (error) {
    return { success: false, error };
  }
}

export async function sendTenantLifecycleEmail(input: SendTenantLifecycleEmailInput) {
  try {
    const result = await getResend().emails.send({
      from: systemSender(),
      to: input.to,
      subject: input.subject,
      text: input.body,
    });
    if (result.error) {
      return { success: false, error: result.error };
    }
    return { success: true, messageId: result.data?.id };
  } catch (error) {
    return { success: false, error };
  }
}

export async function sendUserInvitationEmail(input: SendUserInvitationEmailInput) {
  const roleLabel =
    input.role === "admin"
      ? "Administrator"
      : input.role === "vet"
      ? "Tierarzt"
      : "Empfang";

  const subject = `Einladung zu ${input.practiceName}`;
  const body = `
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
    const result = await getResend().emails.send({
      from: systemSender(),
      to: input.to,
      subject,
      text: body,
    });
    if (result.error) {
      return { success: false, error: result.error };
    }
    return { success: true, messageId: result.data?.id };
  } catch (error) {
    return { success: false, error };
  }
}

export interface SendVaccinationDigestEmailInput {
  ownerEmail: string;
  ownerName: string;
  items: VaccinationDigestItem[];
  clinicName: string;
  bookingUrl?: string;
  unsubscribeUrl?: string;
}

/**
 * Send a single digest email listing all due vaccinations for one owner.
 * This replaces the per-vaccination spam approach: one owner = one email.
 */
export async function sendVaccinationDigestEmail(
  input: SendVaccinationDigestEmailInput
) {
  const petNames = [...new Set(input.items.map((i) => i.petName))];
  const subject =
    petNames.length === 1
      ? `Impf-Erinnerung für ${petNames[0]}`
      : `Impf-Erinnerungen für ${petNames.slice(0, -1).join(", ")} und ${petNames[petNames.length - 1]}`;

  const htmlContent = renderVaccinationDigestEmail({
    ownerName: input.ownerName,
    items: input.items,
    clinicName: input.clinicName,
    bookingUrl: input.bookingUrl,
    unsubscribeUrl: input.unsubscribeUrl,
  });

  const plainText = [
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
    const result = await getResend().emails.send({
      from: tenantSender(input.clinicName),
      to: input.ownerEmail,
      subject,
      html: htmlContent,
      text: plainText,
    });
    if (result.error) return { success: false, error: result.error };
    return { success: true, messageId: result.data?.id };
  } catch (error) {
    return { success: false, error };
  }
}

export async function sendVaccinationReminderEmail(
  input: SendVaccinationReminderEmailInput
) {
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
  const plainText = input.bookingUrl && !input.customBody.includes("{bookingUrl}")
    ? `${baseBody}\n\nDirekt Termin buchen:\n${input.bookingUrl}`
    : baseBody;

  // Render professional HTML template
  const htmlContent = renderVaccinationReminderEmail({
    ownerName: input.ownerName,
    petName: input.petName,
    vaccinationType: input.vaccinationType,
    dueDate,
    clinicName: input.clinicName,
    bookingUrl: input.bookingUrl,
    unsubscribeUrl: input.unsubscribeUrl,
  });

  try {
    const result = await getResend().emails.send({
      from: tenantSender(input.clinicName),
      to: input.ownerEmail,
      subject,
      html: htmlContent,
      text: plainText,
    });
    if (result.error) {
      return { success: false, error: result.error };
    }
    return { success: true, messageId: result.data?.id };
  } catch (error) {
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
  const body = `
Hallo,

Zahlung für "${input.clinicName}" konnte nicht eingezogen werden.

Zahlungsdetails:
- Klinik: ${input.clinicName}
- Grace Period endet: ${gracePeriodDate}
- Danach wird die Praxis automatisch deaktiviert

Der Klinikbetreiber sollte seine Zahlungsmethode aktualisieren:
${input.stripePortalUrl || "Im Konto-Bereich unter Einstellungen"}

Bei Fragen kontaktieren Sie uns unter support@example.com

Mit freundlichen Grüßen,
Ihr Vet Cloud Team
  `.trim();

  try {
    const results = await Promise.all(
      input.adminEmails.map((email) =>
        getResend().emails.send({
          from: systemSender(),
          to: email,
          subject,
          text: body,
        })
      )
    );

    const failed = results.filter((r) => r.error);
    if (failed.length > 0) {
      console.error("Errors sending payment failed emails:", failed);
      return { success: false, errors: failed.map((r) => r.error) };
    }

    return { success: true, messageIds: results.map((r) => r.data?.id) };
  } catch (error) {
    console.error("Error sending payment failed admin emails:", error);
    return { success: false, error };
  }
}

export async function sendTrialExpiredAdminEmail(input: {
  clinicName: string;
  adminEmails: string[];
  adminDashboardUrl: string;
}) {
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

  try {
    const results = await Promise.all(
      input.adminEmails.map((email) =>
        getResend().emails.send({
          from: systemSender(),
          to: email,
          subject,
          text: body,
        })
      )
    );

    const failed = results.filter((r) => r.error);
    if (failed.length > 0) {
      console.error("Errors sending trial expired emails:", failed);
      return { success: false, errors: failed.map((r) => r.error) };
    }

    return { success: true, messageIds: results.map((r) => r.data?.id) };
  } catch (error) {
    console.error("Error sending trial expired admin emails:", error);
    return { success: false, error };
  }
}

export async function sendTrialEndingEmail(input: {
  clinicEmail: string;
  clinicName: string;
  billingUrl: string;
}) {
  const subject = "Deine Testphase endet bald";
  const mainDomain = getSystemDomain();
  const body = `
Hallo ${input.clinicName},

Deine kostenlosen 3 Monate enden bald. Nach dieser Zeit müssen Sie sich für einen Tarif anmelden, um Zugriff auf Vet Cloud zu behalten.

Verfügbare Tarife:
- 1 Nutzer: €30/Monat
- 3 Nutzer: €50/Monat
- 5 Nutzer: €100/Monat
- 10 Nutzer: €200/Monat

Jetzt upgraden: ${mainDomain}${input.billingUrl}

Ohne ein aktives Abo wird Ihre Klinik deaktiviert und nach 30 Tagen gelöscht.

Bei Fragen schreiben Sie uns: support@example.com

Mit freundlichen Grüßen,
Ihr Vet Cloud Team
  `.trim();

  try {
    const result = await getResend().emails.send({
      from: systemSender(),
      to: input.clinicEmail,
      subject,
      text: body,
    });
    if (result.error) return { success: false, error: result.error };
    return { success: true, messageId: result.data?.id };
  } catch (error) {
    return { success: false, error };
  }
}

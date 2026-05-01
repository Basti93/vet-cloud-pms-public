import { Resend } from "resend";
import { emailTemplates, EmailPlaceholders } from "./templates";

const resend = new Resend(process.env.RESEND_API_KEY);

// Use configured FROM_EMAIL or default to Resend's onboarding domain for testing
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

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
  appointmentTime: string;
  appointmentDateTime: string;
  vetName?: string;
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
    const result = await resend.emails.send({
      from: `${input.practiceName} <${FROM_EMAIL}>`,
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
    appointmentDate: "", // Not used in reminder
    appointmentTime: input.appointmentTime,
    appointmentDateTime: input.appointmentDateTime,
    vetName: input.vetName || "Unser Team",
  };

  const body = emailTemplates.reminder.render(
    emailTemplates.reminder.defaultBody,
    placeholders
  );

  const subject = emailTemplates.reminder.defaultSubject
    .replace("{practiceName}", input.practiceName);

  try {
    const result = await resend.emails.send({
      from: `${input.practiceName} <${FROM_EMAIL}>`,
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
    const result = await resend.emails.send({
      from: `VetCloud PMS <${FROM_EMAIL}>`,
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
Ihr VetCloud PMS Team
  `.trim();

  try {
    const result = await resend.emails.send({
      from: `VetCloud PMS <${FROM_EMAIL}>`,
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

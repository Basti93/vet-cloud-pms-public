/**
 * Email Template Placeholders:
 * {practiceName} - Praxisname
 * {ownerFirstName} - Vorname des Besitzers
 * {ownerLastName} - Nachname des Besitzers
 * {patientName} - Name des Patienten
 * {patientSpecies} - Art des Patienten (Hund, Katze, etc.)
 * {appointmentDate} - Termin Datum (z.B. "15. März 2026")
 * {appointmentTime} - Termin Zeit (z.B. "14:30 Uhr")
 * {appointmentDateTime} - Voller Termin (z.B. "15. März 2026 um 14:30 Uhr")
 * {vetName} - Name des Tierarztes
 */

interface EmailPlaceholders {
  practiceName: string;
  ownerFirstName: string;
  ownerLastName?: string;
  patientName: string;
  patientSpecies: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentDateTime: string;
  vetName?: string;
  confirmUrl?: string;
  rejectUrl?: string;
}

function replacePlaceholders(template: string, placeholders: EmailPlaceholders): string {
  let result = template;
  Object.entries(placeholders).forEach(([key, value]) => {
    if (value) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }
  });
  return result;
}

export const emailTemplates = {
  /**
   * Appointment Confirmation - Sent to patient owner immediately after booking
   */
  confirmation: {
    defaultSubject: "Bestätigung: Ihr Termin bei {practiceName}",
    defaultBody: `Hallo {ownerFirstName},

herzlichen Dank für Ihre Terminanfrage! Wir bestätigen Ihren Termin für {patientName} am {appointmentDateTime}.

Termin-Details:
• Patient: {patientName} ({patientSpecies})
• Datum & Uhrzeit: {appointmentDateTime}
• Praxis: {practiceName}

Sollten Sie den Termin absagen müssen, bitten wir Sie, uns rechtzeitig zu benachrichtigen.

Beste Grüße,
{practiceName}`,

    render: (template: string, placeholders: EmailPlaceholders): string => {
      return replacePlaceholders(template, placeholders);
    },
  },

  /**
   * Appointment Reminder - Sent 24 hours before appointment
   */
  reminder: {
    defaultSubject: "Erinnerung: Termin morgen bei {practiceName}",
    defaultBody: `Hallo {ownerFirstName},

dies ist eine freundliche Erinnerung an Ihren morgigen Termin für {patientName}.

Termin-Details:
• Patient: {patientName} ({patientSpecies})
• Uhrzeit: {appointmentTime} Uhr
• Praxis: {practiceName}

Bitte bringen Sie alle notwendigen Unterlagen mit und erscheinen Sie pünktlich.

Sollten Sie den Termin nicht wahrnehmen können, bitten wir um schnellstmögliche Absage.

Beste Grüße,
{practiceName}`,

    render: (template: string, placeholders: EmailPlaceholders): string => {
      return replacePlaceholders(template, placeholders);
    },
  },

  /**
   * Booking Notification - Sent to practice owner when new appointment is booked
   */
  bookingNotification: {
    defaultSubject: "Neue Terminanfrage: {patientName} - {appointmentDate}",
    defaultBody: `Neue Terminanfrage eingegangen!

Patient: {patientName} ({patientSpecies})
Besitzer: {ownerFirstName} {ownerLastName}
Datum & Uhrzeit: {appointmentDateTime}
Tierarzt: {vetName}

Kontakt:
• Telefon: [wird via API eingefügt]
• Email: [wird via API eingefügt]

Diese Anfrage erfordert Ihre Bestätigung im Dashboard.`,

    render: (template: string, placeholders: EmailPlaceholders): string => {
      return replacePlaceholders(template, placeholders);
    },
  },
};

export { replacePlaceholders, EmailPlaceholders };

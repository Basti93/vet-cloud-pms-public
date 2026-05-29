/**
 * HTML email template for vaccination reminders.
 * Returns a complete HTML string suitable for use as the email `html` body.
 * Plain template function — no @react-email/components dependency needed.
 */

interface VaccinationReminderEmailProps {
  ownerName: string;
  petName: string;
  vaccinationType: string;
  dueDate: string;
  clinicName: string;
  bookingUrl?: string;
  unsubscribeUrl?: string;
}

export function renderVaccinationReminderEmail(
  props: VaccinationReminderEmailProps
): string {
  const {
    ownerName,
    petName,
    vaccinationType,
    dueDate,
    clinicName,
    bookingUrl,
    unsubscribeUrl,
  } = props;

  const bookingSection = bookingUrl
    ? `<tr><td style="padding:24px 32px 0;text-align:center;">
        <a href="${escHtml(bookingUrl)}" style="display:inline-block;background:#1a1a2e;color:#ffffff;font-size:15px;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none;">
          Jetzt Termin buchen
        </a>
      </td></tr>`
    : "";

  const unsubscribeSection = unsubscribeUrl
    ? `<p style="font-size:12px;color:#9ca3af;margin:4px 0;">
        Sie möchten keine Erinnerungen mehr?
        <a href="${escHtml(unsubscribeUrl)}" style="color:#6b7280;">Abmelden</a>
      </p>`
    : "";

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Impf-Erinnerung für ${escHtml(petName)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#1a1a2e;padding:20px 32px;">
              <p style="margin:0;color:#ffffff;font-size:16px;font-weight:700;">${escHtml(clinicName)}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 20px;font-size:20px;font-weight:700;color:#111827;">
                Impf-Erinnerung für ${escHtml(petName)}
              </h1>

              <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
                Hallo ${escHtml(ownerName)},
              </p>

              <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
                wir möchten Sie daran erinnern, dass für <strong>${escHtml(petName)}</strong>
                in Kürze eine Auffrischungsimpfung fällig ist:
              </p>

              <!-- Info card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin:0 0 20px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:13px;color:#6b7280;padding-bottom:8px;width:110px;vertical-align:top;">Impfung</td>
                        <td style="font-size:14px;color:#111827;font-weight:600;padding-bottom:8px;">${escHtml(vaccinationType)}</td>
                      </tr>
                      <tr>
                        <td style="font-size:13px;color:#6b7280;padding-bottom:8px;width:110px;vertical-align:top;">Fällig am</td>
                        <td style="font-size:14px;color:#111827;font-weight:600;padding-bottom:8px;">${escHtml(dueDate)}</td>
                      </tr>
                      <tr>
                        <td style="font-size:13px;color:#6b7280;width:110px;vertical-align:top;">Praxis</td>
                        <td style="font-size:14px;color:#111827;font-weight:600;">${escHtml(clinicName)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
                Bitte vereinbaren Sie zeitnah einen Termin, damit der Impfschutz Ihres
                Tieres aufrechterhalten wird.
              </p>

              <p style="margin:0;font-size:15px;color:#374151;line-height:1.6;">
                Mit freundlichen Grüßen,<br />
                Ihr Team von ${escHtml(clinicName)}
              </p>
            </td>
          </tr>

          ${bookingSection}

          <!-- Divider -->
          <tr>
            <td style="padding:24px 32px 0;">
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:0;" />
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;">
              <p style="font-size:12px;color:#9ca3af;margin:0 0 4px;">
                Diese E-Mail wurde automatisch von ${escHtml(clinicName)} versendet.
              </p>
              ${unsubscribeSection}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Escape HTML special characters to prevent injection. */
function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

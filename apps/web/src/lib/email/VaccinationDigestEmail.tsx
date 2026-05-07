/**
 * HTML email template for vaccination reminder digests.
 * Groups multiple pets / vaccinations for one owner into a single email.
 */

export interface VaccinationDigestItem {
  petName: string;
  vaccinationType: string;
  dueDate: string;
}

interface VaccinationDigestEmailProps {
  ownerName: string;
  items: VaccinationDigestItem[];
  clinicName: string;
  bookingUrl?: string;
  unsubscribeUrl?: string;
}

export function renderVaccinationDigestEmail(
  props: VaccinationDigestEmailProps
): string {
  const { ownerName, items, clinicName, bookingUrl, unsubscribeUrl } = props;

  const bookingSection = bookingUrl
    ? `<tr><td style="padding:24px 32px 0;text-align:center;">
        <a href="${esc(bookingUrl)}" style="display:inline-block;background:#1a1a2e;color:#ffffff;font-size:15px;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none;">
          Jetzt Termin buchen
        </a>
      </td></tr>`
    : "";

  const unsubscribeSection = unsubscribeUrl
    ? `<p style="font-size:12px;color:#9ca3af;margin:4px 0;">
        Sie möchten keine Erinnerungen mehr?
        <a href="${esc(unsubscribeUrl)}" style="color:#6b7280;">Abmelden</a>
      </p>`
    : "";

  const intro =
    items.length === 1
      ? `für <strong>${esc(items[0]!.petName)}</strong> ist eine Auffrischungsimpfung fällig:`
      : `für Ihre Tiere stehen folgende Auffrischungsimpfungen an:`;

  const rows = items
    .map(
      (item) => `
      <tr style="border-top:1px solid #e5e7eb;">
        <td style="font-size:14px;color:#374151;padding:10px 20px 10px 0;width:36%;vertical-align:top;">
          <strong>${esc(item.petName)}</strong>
        </td>
        <td style="font-size:14px;color:#111827;padding:10px 20px 10px 0;vertical-align:top;">
          ${esc(item.vaccinationType)}
        </td>
        <td style="font-size:14px;color:#6b7280;padding:10px 0;vertical-align:top;white-space:nowrap;">
          ${esc(item.dueDate)}
        </td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Impf-Erinnerung</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#1a1a2e;padding:20px 32px;">
              <p style="margin:0;color:#ffffff;font-size:16px;font-weight:700;">${esc(clinicName)}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 20px;font-size:20px;font-weight:700;color:#111827;">
                Impf-Erinnerung
              </h1>

              <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
                Hallo ${esc(ownerName)},
              </p>

              <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
                wir möchten Sie daran erinnern, dass ${intro}
              </p>

              <!-- Vaccination table -->
              <table width="100%" cellpadding="0" cellspacing="0"
                style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin:0 0 20px;overflow:hidden;">
                <tr style="background:#f3f4f6;">
                  <th style="text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;padding:10px 20px 10px 0;padding-left:20px;">Tier</th>
                  <th style="text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;padding:10px 20px 10px 0;">Impfung</th>
                  <th style="text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;padding:10px 0;">Fällig am</th>
                </tr>
                <tbody style="padding:0 20px;">
                  ${rows}
                </tbody>
              </table>

              <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
                Bitte vereinbaren Sie zeitnah einen Termin, damit der Impfschutz
                ${items.length === 1 ? "Ihres Tieres" : "Ihrer Tiere"} aufrechterhalten wird.
              </p>

              <p style="margin:0;font-size:15px;color:#374151;line-height:1.6;">
                Mit freundlichen Grüßen,<br />
                Ihr Team von ${esc(clinicName)}
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
                Diese E-Mail wurde automatisch von ${esc(clinicName)} versendet.
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

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

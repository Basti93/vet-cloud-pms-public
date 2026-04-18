/**
 * Email Templates
 * Reusable email templates for different notification types
 */

import type { EmailTemplate } from './types';

export const confirmationTemplate: EmailTemplate = {
  name: 'confirmation',
  subject: 'Termin-Bestätigung erforderlich ✓',
  getHtml: (variables) => {
    const { patientName, clinicName, date, time, ownerName, confirmLink } = variables;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .info-box { background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; border-radius: 4px; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; margin: 20px 0; font-weight: bold; }
    .footer { text-align: center; font-size: 12px; color: #999; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Bestätigung erforderlich</h1>
    </div>
    <div class="content">
      <p>Hallo ${ownerName},</p>

      <p>Ihr Termin in der <strong>${clinicName}</strong> wurde angefordert:</p>

      <div class="info-box">
        <p><strong>Patient:</strong> ${patientName}</p>
        <p><strong>Datum:</strong> ${date}</p>
        <p><strong>Uhrzeit:</strong> ${time}</p>
      </div>

      <p>Bitte bestätigen Sie den Termin, indem Sie auf den folgenden Link klicken:</p>

      <a href="${confirmLink}" class="button">Termin bestätigen →</a>

      <p style="color: #666; font-size: 14px;">
        Der Link ist 24 Stunden lang gültig. Nach dieser Zeit müssen Sie einen neuen Termin buchen.
      </p>

      <p>Wenn Sie den Termin stornieren möchten, antworten Sie einfach auf diese E-Mail.</p>

      <div class="footer">
        <p>${clinicName} | Diese E-Mail wurde automatisch gesendet. Bitte nicht antworten.</p>
      </div>
    </div>
  </div>
</body>
</html>
    `;
  },
};

export const cancellationTemplate: EmailTemplate = {
  name: 'cancellation',
  subject: 'Termin abgesagt',
  getHtml: (variables) => {
    const { patientName, clinicName, date, time, ownerName, reason } = variables;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #ff6b6b; color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .info-box { background: white; padding: 20px; border-left: 4px solid #ff6b6b; margin: 20px 0; border-radius: 4px; }
    .footer { text-align: center; font-size: 12px; color: #999; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Termin abgesagt</h1>
    </div>
    <div class="content">
      <p>Hallo ${ownerName},</p>

      <p>Ihr Termin bei <strong>${clinicName}</strong> wurde abgesagt:</p>

      <div class="info-box">
        <p><strong>Patient:</strong> ${patientName}</p>
        <p><strong>Termin:</strong> ${date} um ${time}</p>
        ${reason ? `<p><strong>Grund:</strong> ${reason}</p>` : ''}
      </div>

      <p>Um einen neuen Termin zu buchen, besuchen Sie bitte unsere Online-Terminbuchung.</p>

      <div class="footer">
        <p>${clinicName}</p>
      </div>
    </div>
  </div>
</body>
</html>
    `;
  },
};

export const reminderTemplate: EmailTemplate = {
  name: 'reminder',
  subject: 'Erinnerung: Ihr Termin morgen',
  getHtml: (variables) => {
    const { patientName, clinicName, date, time, ownerName, address } = variables;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #4ecdc4; color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .info-box { background: white; padding: 20px; border-left: 4px solid #4ecdc4; margin: 20px 0; border-radius: 4px; }
    .footer { text-align: center; font-size: 12px; color: #999; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Erinnerung</h1>
    </div>
    <div class="content">
      <p>Hallo ${ownerName},</p>

      <p>Dies ist eine freundliche Erinnerung an Ihren morgigen Termin bei <strong>${clinicName}</strong>:</p>

      <div class="info-box">
        <p><strong>Patient:</strong> ${patientName}</p>
        <p><strong>Zeit:</strong> ${time}</p>
        <p><strong>Adresse:</strong> ${address}</p>
      </div>

      <p>Bitte beachten Sie, dass Sie 10 Minuten vor Ihrem Termin anwesend sein sollten.</p>

      <p>Falls Sie nicht erscheinen können, teilen Sie uns bitte so schnell wie möglich mit, damit wir den Termin für einen anderen Patienten freigeben können.</p>

      <div class="footer">
        <p>${clinicName}</p>
      </div>
    </div>
  </div>
</body>
</html>
    `;
  },
};

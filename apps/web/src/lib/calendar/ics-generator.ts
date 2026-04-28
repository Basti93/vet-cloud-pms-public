export interface ICalEventData {
  appointment: any;
  patient: any & { owner: any };
  veterinarian: any;
  clinicName: string;
  clinicAddress?: string;
  clinicCity?: string;
  practiceTimezone: string;
}

/**
 * Generate RFC 5545 compliant iCal (ICS) format for veterinary appointments
 * @param events Array of appointments with related data
 * @param clinicEmail Email address for organizer
 * @param clinicDomain Domain for generating unique event UIDs
 * @param clinicName Clinic name
 * @returns iCal format string (text/calendar)
 */
export function generateAppointmentICS(
  events: ICalEventData[],
  clinicEmail: string,
  clinicDomain: string,
  clinicName: string
): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//Vet Cloud//Appointment Calendar//DE`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  // Add events
  events.forEach((event) => {
    const {
      appointment,
      patient,
      veterinarian,
      clinicAddress,
      clinicCity,
      practiceTimezone,
    } = event;

    // Build event summary: "PatientName (Species) - VetName"
    const patientDisplay = `${patient.name} (${patient.species || 'unknown'})`;
    const vetDisplay = [veterinarian.title, veterinarian.firstName, veterinarian.lastName]
      .filter(Boolean)
      .join(' ');
    const summary = `${patientDisplay} - ${vetDisplay}`;

    // Build location
    const locationParts = [clinicName, clinicAddress, clinicCity].filter(Boolean);
    const location = locationParts.join(', ');

    // Build description
    const ownerName = `${patient.owner.firstName} ${patient.owner.lastName}`;
    const ownerPhone = patient.owner.phone || '';
    const appointmentReason = appointment.title || 'Termin';
    const description = [
      `Haustier: ${patientDisplay}`,
      patient.breed ? `Rasse: ${patient.breed}` : '',
      `Grund: ${appointmentReason}`,
      `Besitzer: ${ownerName}`,
      ownerPhone ? `Telefon: ${ownerPhone}` : '',
    ]
      .filter(Boolean)
      .join('\\n');

    // Map appointment status
    const statusMap: Record<string, string> = {
      scheduled: 'CONFIRMED',
      confirmed: 'CONFIRMED',
      completed: 'CONFIRMED',
      cancelled: 'CANCELLED',
      'no-show': 'CANCELLED',
    };
    const icalStatus = statusMap[appointment.status] || 'TENTATIVE';

    // Format dates for iCal (YYYYMMDDTHHMMSSZ format)
    const startTime = new Date(appointment.startTime);
    const endTime = new Date(appointment.endTime);
    const createdTime = new Date(appointment.createdAt);
    const modifiedTime = new Date(appointment.updatedAt);

    const formatDate = (date: Date) =>
      date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

    lines.push(
      'BEGIN:VEVENT',
      `UID:appt-${appointment.id}@${clinicDomain}`,
      `DTSTAMP:${formatDate(createdTime)}`,
      `DTSTART:${formatDate(startTime)}`,
      `DTEND:${formatDate(endTime)}`,
      `CREATED:${formatDate(createdTime)}`,
      `LAST-MODIFIED:${formatDate(modifiedTime)}`,
      `SUMMARY:${escapeText(summary)}`,
      `DESCRIPTION:${escapeText(description)}`,
      `LOCATION:${escapeText(location)}`,
      `STATUS:${icalStatus}`,
      `SEQUENCE:0`,
      `ORGANIZER;CN=${escapeText(clinicName)}:mailto:${clinicEmail}`,
      `ATTENDEE;CN=${escapeText(ownerName)};RSVP=TRUE:mailto:${patient.owner.email || ''}`,
      'TRANSP:OPAQUE',
      'END:VEVENT'
    );
  });

  lines.push('END:VCALENDAR', '');
  return lines.join('\r\n');
}

/**
 * Escape special characters in iCal text fields
 */
function escapeText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

/**
 * Get TZID string for iCal (timezone identifier)
 * @param ianaTimezone IANA timezone string (e.g., "Europe/Berlin")
 * @returns TZID for use in DTSTART;TZID= format
 */
export function getTZID(ianaTimezone: string): string {
  // IANA timezones are compatible with TZID in iCal format
  return ianaTimezone;
}

/**
 * Verify iCal format is valid RFC 5545
 * @param icsContent iCal format string
 * @returns true if valid structure
 */
export function validateICalFormat(icsContent: string): boolean {
  return (
    icsContent.startsWith('BEGIN:VCALENDAR') &&
    icsContent.includes('BEGIN:VEVENT') &&
    icsContent.endsWith('END:VCALENDAR\n')
  );
}

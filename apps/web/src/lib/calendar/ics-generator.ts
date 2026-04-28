import ICalendarGenerator from 'ical-generator';

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
 * @returns iCal format string (text/calendar)
 */
export function generateAppointmentICS(
  events: ICalEventData[],
  clinicEmail: string,
  clinicDomain: string,
  clinicName: string
): string {
  // @ts-ignore - ical-generator TypeScript types are not properly exported
  const cal = new ICalendarGenerator({
    prodId: {
      company: 'Vet Cloud',
      product: 'Appointment Calendar',
      language: 'de',
    },
    timezone: 'Europe/Berlin', // Default, will be specified per event
  });

  // Add events
  events.forEach((event) => {
    const {
      appointment,
      patient,
      veterinarian,
      clinicName,
      clinicAddress,
      clinicCity,
      practiceTimezone,
    } = event;

    // Build event summary: "PatientName (Species) - VetName"
    const patientDisplay = `${patient.name} (${patient.species || 'unknown'})`;
    const vetDisplay = [
      veterinarian.title,
      veterinarian.firstName,
      veterinarian.lastName,
    ]
      .filter(Boolean)
      .join(' ');

    const summary = `${patientDisplay} - ${vetDisplay}`;

    // Build location
    const locationParts = [clinicName, clinicAddress, clinicCity]
      .filter(Boolean);
    const location = locationParts.join(', ');

    // Build description with rich context
    const ownerName = `${patient.owner.firstName} ${patient.owner.lastName}`;
    const ownerPhone = patient.owner.phone || '';
    const appointmentReason = appointment.title || 'Termine';

    const description = [
      `Haustier: ${patientDisplay}`,
      patient.breed ? `Rasse: ${patient.breed}` : '',
      `Grund: ${appointmentReason}`,
      `Besitzer: ${ownerName}`,
      ownerPhone ? `Telefon: ${ownerPhone}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    // Map appointment status to iCal STATUS
    const statusMap: Record<string, 'CONFIRMED' | 'CANCELLED' | 'TENTATIVE'> = {
      scheduled: 'CONFIRMED',
      confirmed: 'CONFIRMED',
      completed: 'CONFIRMED',
      cancelled: 'CANCELLED',
      'no-show': 'CANCELLED',
    };
    const icalStatus = statusMap[appointment.status] || 'TENTATIVE';

    // Add event to calendar
    cal.createEvent({
      id: `appt-${appointment.id}@${clinicDomain}`,
      summary,
      description,
      location,
      start: new Date(appointment.startTime),
      end: new Date(appointment.endTime),
      timezone: practiceTimezone,
      organizer: {
        name: clinicName,
        email: clinicEmail,
      },
      attendees: [
        {
          name: ownerName,
          email: patient.owner.email || '',
          rsvp: true,
          partstat: 'NEEDS-ACTION',
        },
      ],
      status: icalStatus,
      created: new Date(appointment.createdAt),
      lastModified: new Date(appointment.updatedAt),
      sequence: 0, // Increment on updates for sync tracking
      // Add Microsoft Outlook specific fields
      busystatus: 'BUSY',
      transp: 'OPAQUE', // Opaque = busy, Transparent = free
      url: undefined, // Could link to clinic website
    });
  });

  return cal.toString();
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

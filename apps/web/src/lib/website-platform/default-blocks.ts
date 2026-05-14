import { openingHoursToDisplayRows, normalizeWeekSchedule, type DaySchedule } from "@/lib/schedule-types";
import type { WebsitePageBlock } from "./types";

function buildHoursSections(rawHours: DaySchedule[] | null | undefined) {
  const rows = openingHoursToDisplayRows(normalizeWeekSchedule(rawHours));
  return [{ id: "regular", title: "Sprechzeiten", rows: rows.map((r) => ({ days: r.day, time: r.time })) }];
}

export function createDefaultWebsiteBlocks(input: {
  practiceName: string;
  tenantSlug?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  openingHours?: DaySchedule[] | null;
}): WebsitePageBlock[] {
  const address = [input.address, input.city].filter(Boolean).join("\n") || undefined;

  return [
    {
      id: "hero-default",
      type: "hero",
      props: {
        eyebrow: "Ihre Praxiswebsite",
        title: input.practiceName || "Ihre Tierarztpraxis",
        subtitle: "Stellen Sie Ihre Praxis, Ihr Team und Ihre Leistungen vor — mit direkter Online-Terminbuchung.",
        primaryCtaLabel: "Termin buchen",
        secondaryCtaLabel: "Kontakt",
      },
    },
    {
      id: "services-default",
      type: "servicesGrid",
      props: {
        heading: "Unsere Leistungen",
        intro: "Passen Sie diese Leistungen im Website-Studio an Ihre Praxis an.",
        services: [
          { id: "vorsorge", title: "Vorsorge", description: "Regelmäßige Untersuchungen und Beratung für Ihr Tier.", iconKey: "Heart" },
          { id: "sprechstunde", title: "Sprechstunde", description: "Kompetente Hilfe bei akuten und chronischen Beschwerden.", iconKey: "Stethoscope" },
          { id: "diagnostik", title: "Diagnostik", description: "Moderne Untersuchung, Labor und weiterführende Abklärung.", iconKey: "Microscope" },
        ],
      },
    },
    {
      id: "hours-default",
      type: "hoursTable",
      props: {
        heading: "Öffnungszeiten",
        useManualOverride: false,
        sections: buildHoursSections(input.openingHours),
      },
    },
    {
      id: "booking-default",
      type: "bookingCta",
      props: {
        heading: "Termin online buchen",
        text: "Ihre Kundinnen und Kunden können direkt online einen Termin anfragen.",
        buttonLabel: "Termin buchen",
      },
    },
    {
      id: "contact-default",
      type: "contactCard",
      props: {
        heading: "Kontakt",
        description: "Erreichbarkeit Ihrer Praxis.",
        useManualOverride: false,
        address,
        phone: input.phone ?? undefined,
        email: input.email ?? undefined,
      },
    },
    {
      id: "form-default",
      type: "contactForm",
      props: {
        heading: "Nachricht senden",
        useManualOverride: false,
        consentLabel: "Ich stimme der Verarbeitung meiner Angaben zur Kontaktaufnahme zu.",
      },
    },
  ];
}

export function createDefaultLegalBlocks(type: "impressum" | "datenschutz", practiceName: string): WebsitePageBlock[] {
  if (type === "impressum") {
    return [
      {
        id: "legal-impressum-default",
        type: "legalText",
        props: {
          heading: "Impressum",
          html: `<p><strong>${practiceName}</strong></p><p>Bitte ergänzen Sie hier die rechtlich erforderlichen Angaben: Anschrift, Vertretungsberechtigte, Kontakt, zuständige Kammer, Berufsbezeichnung und Aufsichtsbehörde.</p>`,
        },
      },
    ];
  }

  return [
    {
      id: "legal-datenschutz-default",
      type: "legalText",
      props: {
        heading: "Datenschutzerklärung",
        html: `<p>Bitte ergänzen Sie hier Ihre Datenschutzerklärung, inklusive Verantwortliche Stelle, Kontaktmöglichkeiten, Verarbeitungszwecke, Rechtsgrundlagen, Speicherdauer und Betroffenenrechte.</p>`,
      },
    },
  ];
}

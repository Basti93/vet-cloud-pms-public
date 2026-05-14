import { z } from "zod";
import { blockPropsByType } from "./schemas";

export type WebsiteBlockType = keyof typeof blockPropsByType;

export const WEBSITE_BLOCK_DEFINITIONS: Record<WebsiteBlockType, { label: string; description: string; capability?: string }> = {
  hero: { label: "Hero", description: "Intro area with CTA and optional image" },
  richText: { label: "Text", description: "Formatted content block" },
  servicesGrid: { label: "Leistungen", description: "Service cards" },
  teamList: { label: "Team", description: "Team profiles", capability: "teamProfiles" },
  hoursTable: { label: "Öffnungszeiten", description: "Opening hour sections" },
  contactCard: { label: "Kontaktkarte", description: "Address, phone, email" },
  contactForm: { label: "Kontaktformular", description: "Lead capture form", capability: "contactForm" },
  bookingCta: { label: "Termin-CTA", description: "Booking call-to-action", capability: "booking" },
  mapEmbed: { label: "Karte", description: "Map embed/address" },
  legalText: { label: "Rechtstext", description: "Impressum/privacy/legal content" },
};

export function validateBlockProps(type: WebsiteBlockType, props: unknown) {
  const schema = blockPropsByType[type] as z.ZodTypeAny;
  return schema.parse(props);
}

export function getDefaultBlock(type: WebsiteBlockType) {
  const props = validateBlockProps(type, {});
  return { id: `${type}-${Date.now()}`, type, props };
}

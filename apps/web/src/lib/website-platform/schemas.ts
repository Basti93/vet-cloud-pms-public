import { z } from "zod";

export const assetRefSchema = z.object({
  assetId: z.string().uuid().optional(),
  url: z.string().min(1).optional(),
  altOverride: z.string().optional(),
});

export const themeConfigSchema = z.object({
  palette: z.enum(["sage", "warmsand", "klinikblau", "bordeaux", "forest", "schiefer"]).default("sage"),
  typography: z.enum(["modern", "klassisch", "klinisch", "freundlich"]).default("modern"),
  radius: z.enum(["sm", "md", "lg", "xl"]).default("lg"),
  density: z.enum(["compact", "comfortable", "spacious"]).default("comfortable"),
});

export const bookingCapabilitySchema = z.object({
  enabled: z.boolean().default(false),
  mode: z.enum(["pms", "external", "none"]).default("none"),
  tenantSlug: z.string().optional(),
  externalUrl: z.string().optional(),
});

export const capabilityConfigSchema = z.object({
  booking: bookingCapabilitySchema.default({ enabled: false, mode: "none" }),
  contactForm: z.object({ enabled: z.boolean().default(true), notifyEmail: z.string().email().optional() }).default({ enabled: true }),
  teamProfiles: z.object({ enabled: z.boolean().default(true) }).default({ enabled: true }),
  reviews: z.object({ enabled: z.boolean().default(false) }).default({ enabled: false }),
  blog: z.object({ enabled: z.boolean().default(false) }).default({ enabled: false }),
});

export const websiteProjectSeoSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  canonicalUrl: z.string().optional(),
  ogImage: assetRefSchema.optional(),
  robotsIndex: z.boolean().default(true).optional(),
});

export const heroBlockSchema = z.object({
  eyebrow: z.string().optional(),
  title: z.string().min(1).default("Willkommen"),
  subtitle: z.string().optional(),
  image: assetRefSchema.optional(),
  images: z.array(assetRefSchema).default([]),
  slideshowInterval: z.number().int().min(2).max(30).default(5),
  primaryCtaLabel: z.string().default("Termin buchen"),
  secondaryCtaLabel: z.string().default("Kontakt"),
});

export const richTextBlockSchema = z.object({
  heading: z.string().optional(),
  html: z.string().default(""),
});

export const servicesGridBlockSchema = z.object({
  heading: z.string().default("Unsere Leistungen"),
  intro: z.string().optional(),
  services: z.array(z.object({ id: z.string(), title: z.string(), description: z.string(), iconKey: z.string().optional() })).default([]),
});

export const teamListBlockSchema = z.object({
  heading: z.string().default("Unser Team"),
  intro: z.string().optional(),
  people: z.array(z.object({ id: z.string(), name: z.string(), title: z.string().optional(), image: assetRefSchema.optional(), bio: z.string().optional(), focus: z.array(z.string()).default([]) })).default([]),
});

export const hoursTableBlockSchema = z.object({
  heading: z.string().default("Öffnungszeiten"),
  useManualOverride: z.boolean().default(false),
  consultationTitle: z.string().default("Sprechzeiten"),
  consultationChipLabel: z.string().optional(),
  consultationNote: z.string().optional(),
  openingTitle: z.string().default("Öffnungszeiten"),
  openingChipLabel: z.string().optional(),
  openingNote: z.string().optional(),
  sections: z.array(z.object({ id: z.string(), title: z.string(), chipLabel: z.string().optional(), chipColor: z.string().optional(), note: z.string().optional(), rows: z.array(z.object({ days: z.string(), time: z.string() })).default([]) })).default([]),
});

export const specialHoursBlockSchema = z.object({
  heading: z.string().default("Urlaubszeiten"),
  note: z.string().optional(),
  emptyText: z.string().default("Aktuell sind keine abweichenden Öffnungszeiten hinterlegt."),
});

export const contactCardBlockSchema = z.object({
  heading: z.string().default("Kontakt"),
  description: z.string().optional(),
  useManualOverride: z.boolean().default(false),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  embedUrl: z.string().optional(),
});

export const contactFormBlockSchema = z.object({
  heading: z.string().default("Nachricht senden"),
  useManualOverride: z.boolean().default(false),
  consentLabel: z.string().default("Ich stimme der Verarbeitung meiner Angaben zur Kontaktaufnahme zu."),
});

export const bookingCtaBlockSchema = z.object({
  heading: z.string().default("Termin online buchen"),
  text: z.string().optional(),
  buttonLabel: z.string().default("Termin buchen"),
});

export const mapEmbedBlockSchema = z.object({
  heading: z.string().optional(),
  useManualOverride: z.boolean().default(false),
  embedUrl: z.string().optional(),
  address: z.string().optional(),
});

export const legalTextBlockSchema = z.object({
  heading: z.string().default("Rechtliches"),
  html: z.string().default(""),
});

export const blockPropsByType = {
  hero: heroBlockSchema,
  richText: richTextBlockSchema,
  servicesGrid: servicesGridBlockSchema,
  teamList: teamListBlockSchema,
  hoursTable: hoursTableBlockSchema,
  specialHours: specialHoursBlockSchema,
  contactCard: contactCardBlockSchema,
  contactForm: contactFormBlockSchema,
  bookingCta: bookingCtaBlockSchema,
  mapEmbed: mapEmbedBlockSchema,
  legalText: legalTextBlockSchema,
} as const;

export const pageBlockSchema = z.discriminatedUnion("type", [
  z.object({ id: z.string(), type: z.literal("hero"), variant: z.string().optional(), props: heroBlockSchema, visibility: z.any().optional() }),
  z.object({ id: z.string(), type: z.literal("richText"), variant: z.string().optional(), props: richTextBlockSchema, visibility: z.any().optional() }),
  z.object({ id: z.string(), type: z.literal("servicesGrid"), variant: z.string().optional(), props: servicesGridBlockSchema, visibility: z.any().optional() }),
  z.object({ id: z.string(), type: z.literal("teamList"), variant: z.string().optional(), props: teamListBlockSchema, visibility: z.any().optional() }),
  z.object({ id: z.string(), type: z.literal("hoursTable"), variant: z.string().optional(), props: hoursTableBlockSchema, visibility: z.any().optional() }),
  z.object({ id: z.string(), type: z.literal("specialHours"), variant: z.string().optional(), props: specialHoursBlockSchema, visibility: z.any().optional() }),
  z.object({ id: z.string(), type: z.literal("contactCard"), variant: z.string().optional(), props: contactCardBlockSchema, visibility: z.any().optional() }),
  z.object({ id: z.string(), type: z.literal("contactForm"), variant: z.string().optional(), props: contactFormBlockSchema, visibility: z.any().optional() }),
  z.object({ id: z.string(), type: z.literal("bookingCta"), variant: z.string().optional(), props: bookingCtaBlockSchema, visibility: z.any().optional() }),
  z.object({ id: z.string(), type: z.literal("mapEmbed"), variant: z.string().optional(), props: mapEmbedBlockSchema, visibility: z.any().optional() }),
  z.object({ id: z.string(), type: z.literal("legalText"), variant: z.string().optional(), props: legalTextBlockSchema, visibility: z.any().optional() }),
]);

export const pageBlocksSchema = z.array(pageBlockSchema).max(80);

export function normalizeThemeConfig(value: unknown) {
  return themeConfigSchema.catch({ palette: "sage", typography: "modern", radius: "lg", density: "comfortable" }).parse(value ?? {});
}

export function normalizeCapabilities(value: unknown) {
  return capabilityConfigSchema.parse(value ?? {});
}

export function normalizeBlocks(value: unknown) {
  return pageBlocksSchema.catch([]).parse(value ?? []);
}

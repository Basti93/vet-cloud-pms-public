export type WebsiteLayoutKey = "praxis-classic" | "praxis-editorial" | "landing-simple";

export const WEBSITE_LAYOUTS: Record<WebsiteLayoutKey, { label: string; description: string; supportedBlocks: string[] }> = {
  "praxis-classic": {
    label: "Praxis Classic",
    description: "Warm, local practice website with clear booking and contact flow.",
    supportedBlocks: ["hero", "servicesGrid", "teamList", "hoursTable", "contactCard", "contactForm", "bookingCta", "mapEmbed", "legalText", "richText"],
  },
  "praxis-editorial": {
    label: "Praxis Editorial",
    description: "Premium editorial storytelling for established practices.",
    supportedBlocks: ["hero", "richText", "servicesGrid", "teamList", "bookingCta", "contactCard", "mapEmbed", "legalText"],
  },
  "landing-simple": {
    label: "Simple Landing",
    description: "Lean standalone landing page for lead capture.",
    supportedBlocks: ["hero", "richText", "servicesGrid", "contactForm", "contactCard", "legalText"],
  },
};

export function resolveLayoutKey(key?: string | null): WebsiteLayoutKey {
  if (key && key in WEBSITE_LAYOUTS) return key as WebsiteLayoutKey;
  return "praxis-classic";
}

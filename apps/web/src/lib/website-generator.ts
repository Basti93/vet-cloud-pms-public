import { WebsiteTemplateKey } from './theme';
import { ModernTemplate } from '@/components/website/templates/ModernTemplate';
import { KlassikTemplate } from '@/components/website/templates/KlassikTemplate';
import { KompaktTemplate } from '@/components/website/templates/KompaktTemplate';

export interface WebsiteData {
  brandName: string;
  tagline: string;
  monogram: string;
  slug: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
}

export function getTemplateComponent(templateKey: WebsiteTemplateKey) {
  switch (templateKey) {
    case 'modern':
      return ModernTemplate;
    case 'klassik':
      return KlassikTemplate;
    case 'kompakt':
      return KompaktTemplate;
    default:
      return ModernTemplate;
  }
}

export function generateWebsite(
  templateKey: WebsiteTemplateKey,
  data: WebsiteData,
  customCode?: string | null
) {
  if (customCode) {
    return { type: 'custom' as const, code: customCode };
  }
  return { type: 'auto' as const, component: getTemplateComponent(templateKey), data };
}

export function getTemplateName(templateKey: WebsiteTemplateKey): string {
  switch (templateKey) {
    case 'modern': return 'Modern';
    case 'klassik': return 'Klassik';
    case 'kompakt': return 'Kompakt';
    default: return 'Modern';
  }
}

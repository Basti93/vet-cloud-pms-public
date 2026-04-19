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

/**
 * Get the appropriate template component based on the template key.
 * Returns the React component that can be rendered with the provided data.
 */
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

/**
 * Generate a website for a tenant using the specified template and data.
 * Mode A: Auto-generated (default) - uses template component
 * Mode B: Custom code - renders custom HTML if available
 */
export function generateWebsite(
  templateKey: WebsiteTemplateKey,
  data: WebsiteData,
  customCode?: string | null
) {
  // Mode B: Custom code escape hatch
  if (customCode) {
    return {
      type: 'custom' as const,
      code: customCode,
    };
  }

  // Mode A: Auto-generated
  const TemplateComponent = getTemplateComponent(templateKey);
  return {
    type: 'auto' as const,
    component: TemplateComponent,
    data,
  };
}

/**
 * Get template display name for UI
 */
export function getTemplateName(templateKey: WebsiteTemplateKey): string {
  switch (templateKey) {
    case 'modern':
      return 'Modern';
    case 'klassik':
      return 'Klassik';
    case 'kompakt':
      return 'Kompakt';
    default:
      return 'Modern';
  }
}

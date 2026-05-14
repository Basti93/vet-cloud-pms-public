'use client';

import type { WebsiteCapabilityConfig, WebsitePageBlock } from '@/lib/website-platform/types';
import { isCapabilityEnabled } from '@/lib/website-platform/capabilities';
import { WEBSITE_BLOCK_DEFINITIONS } from '@/lib/website-platform/block-registry';
import {
  BookingCtaBlock,
  ContactCardBlock,
  ContactFormBlock,
  HeroBlock,
  HoursTableBlock,
  LegalTextBlock,
  MapEmbedBlock,
  RichTextBlock,
  ServicesGridBlock,
  TeamListBlock,
} from '../blocks/WebsiteBlocks';

interface Props {
  block: WebsitePageBlock;
  capabilities: WebsiteCapabilityConfig;
  assetMap?: Record<string, string>;
  projectId: string;
  pagePath: string;
  tenantHoursRows?: { days: string; time: string }[] | null;
  tenantContactInfo?: { address?: string | null; phone?: string | null; email?: string | null; city?: string | null } | null;
}

export function BlockRenderer(props: Props) {
  const requiredCapability = WEBSITE_BLOCK_DEFINITIONS[props.block.type]?.capability as keyof WebsiteCapabilityConfig | undefined;
  if (requiredCapability && !isCapabilityEnabled(props.capabilities, requiredCapability)) return null;

  switch (props.block.type) {
    case 'hero': return <HeroBlock {...props} block={props.block} />;
    case 'richText': return <RichTextBlock {...props} block={props.block} />;
    case 'servicesGrid': return <ServicesGridBlock {...props} block={props.block} />;
    case 'teamList': return <TeamListBlock {...props} block={props.block} />;
    case 'hoursTable': return <HoursTableBlock {...props} block={props.block} tenantHoursRows={props.tenantHoursRows} />;
    case 'contactCard': return <ContactCardBlock {...props} block={props.block} tenantContactInfo={props.tenantContactInfo} />;
    case 'contactForm': return <ContactFormBlock {...props} block={props.block} />;
    case 'bookingCta': return <BookingCtaBlock {...props} block={props.block} />;
    case 'mapEmbed': return <MapEmbedBlock {...props} block={props.block} tenantContactInfo={props.tenantContactInfo} />;
    case 'legalText': return <LegalTextBlock {...props} block={props.block} />;
    default: return null;
  }
}

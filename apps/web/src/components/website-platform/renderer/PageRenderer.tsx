'use client';

import type { ResolvedWebsitePage } from '@/lib/website-platform/types';
import { buildTemplateVars } from '@/lib/website-platform/template';
import { BlockRenderer } from './BlockRenderer';
import { PraxisLayout } from '../layouts/PraxisLayout';

export function PageRenderer({ resolved, assetMap, previewToken }: { resolved: ResolvedWebsitePage; assetMap?: Record<string, string>; previewToken?: string }) {
  const templateVars = buildTemplateVars({
    projectName: resolved.project.name,
    contactInfo: resolved.project.tenantContactInfo,
    teamMembers: resolved.project.teamMembers,
  });

  return (
    <PraxisLayout resolved={resolved} assetMap={assetMap} previewToken={previewToken}>
      {resolved.blocks.map((block) => (
        <BlockRenderer key={block.id} block={block} capabilities={resolved.project.capabilities} assetMap={assetMap} projectId={resolved.project.id} pagePath={resolved.page.path} templateVars={templateVars} previewToken={previewToken} tenantHoursRows={resolved.project.tenantHoursRows} tenantConsultationHoursRows={resolved.project.tenantConsultationHoursRows} tenantOpeningHoursRows={resolved.project.tenantOpeningHoursRows} tenantSpecialHours={resolved.project.tenantSpecialHours} tenantContactInfo={resolved.project.tenantContactInfo} />
      ))}
    </PraxisLayout>
  );
}

'use client';

import type { ResolvedWebsitePage } from '@/lib/website-platform/types';
import { buildTemplateVars } from '@/lib/website-platform/template';
import { BlockRenderer } from './BlockRenderer';
import { PraxisLayout } from '../layouts/PraxisLayout';

export function PageRenderer({ resolved, assetMap }: { resolved: ResolvedWebsitePage; assetMap?: Record<string, string> }) {
  const templateVars = buildTemplateVars({
    projectName: resolved.project.name,
    contactInfo: resolved.project.tenantContactInfo,
    teamMembers: resolved.project.teamMembers,
  });

  return (
    <PraxisLayout resolved={resolved} assetMap={assetMap}>
      {resolved.blocks.map((block) => (
        <BlockRenderer key={block.id} block={block} capabilities={resolved.project.capabilities} assetMap={assetMap} projectId={resolved.project.id} pagePath={resolved.page.path} templateVars={templateVars} tenantHoursRows={resolved.project.tenantHoursRows} tenantContactInfo={resolved.project.tenantContactInfo} />
      ))}
    </PraxisLayout>
  );
}

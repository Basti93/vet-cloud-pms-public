'use client';

import type { ResolvedWebsitePage } from '@/lib/website-platform/types';
import { BlockRenderer } from './BlockRenderer';
import { PraxisLayout } from '../layouts/PraxisLayout';

export function PageRenderer({ resolved, assetMap }: { resolved: ResolvedWebsitePage; assetMap?: Record<string, string> }) {
  return (
    <PraxisLayout resolved={resolved} assetMap={assetMap}>
      {resolved.blocks.map((block) => (
        <BlockRenderer key={block.id} block={block} capabilities={resolved.project.capabilities} assetMap={assetMap} projectId={resolved.project.id} pagePath={resolved.page.path} tenantHoursRows={resolved.project.tenantHoursRows} tenantContactInfo={resolved.project.tenantContactInfo} />
      ))}
    </PraxisLayout>
  );
}

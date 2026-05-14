import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { createTRPCRouter, protectedProcedure, type TRPCContext } from '@/server/trpc';
import { tenants, websiteAssets, websiteDomains, websiteLeads, websitePageRevisions, websitePages, websiteProjects } from '@/lib/db/schema';
import { capabilityConfigSchema, normalizeBlocks, pageBlocksSchema, themeConfigSchema, websiteProjectSeoSchema } from '@/lib/website-platform/schemas';
import { normalizeWebsiteHost, normalizeWebsitePath } from '@/lib/website-platform/resolve-project';
import { createDefaultLegalBlocks, createDefaultWebsiteBlocks } from '@/lib/website-platform/default-blocks';
import type { DaySchedule } from '@/lib/schedule-types';

function ctxTenant(ctx: unknown) {
  const value = ctx as { tenantId?: string; dbUserId?: string };
  if (!value.tenantId) throw new TRPCError({ code: 'FORBIDDEN', message: 'Tenant required' });
  return { tenantId: value.tenantId, dbUserId: value.dbUserId };
}

async function requireProjectAccess(ctx: TRPCContext & { tenantId?: string; dbUserId?: string }, projectId: string) {
  const { tenantId } = ctxTenant(ctx);
  const [project] = await ctx.db.select().from(websiteProjects).where(and(eq(websiteProjects.id, projectId), eq(websiteProjects.ownerTenantId, tenantId))).limit(1);
  if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Website project not found' });
  return project;
}

async function createPageWithInitialDraft(
  ctx: TRPCContext & { tenantId?: string; dbUserId?: string },
  input: {
    projectId: string;
    path: string;
    title: string;
    pageType: 'default' | 'legal_impressum' | 'legal_privacy' | 'landing' | 'booking';
    blocks: unknown;
    isHomepage?: boolean;
  }
) {
  const normalizedPath = normalizeWebsitePath(input.path);
  const [page] = await ctx.db
    .insert(websitePages)
    .values({
      websiteProjectId: input.projectId,
      path: normalizedPath,
      title: input.title,
      pageType: input.pageType,
      isHomepage: Boolean(input.isHomepage),
    })
    .onConflictDoUpdate({
      target: [websitePages.websiteProjectId, websitePages.path],
      set: {
        title: input.title,
        pageType: input.pageType,
        isHomepage: Boolean(input.isHomepage),
        updatedAt: new Date(),
      },
    })
    .returning();

  const [existingDraft] = await ctx.db
    .select({ id: websitePageRevisions.id })
    .from(websitePageRevisions)
    .where(and(eq(websitePageRevisions.websitePageId, page.id), eq(websitePageRevisions.state, 'draft')))
    .limit(1);
  if (!existingDraft) {
    await ctx.db.insert(websitePageRevisions).values({
      websitePageId: page.id,
      version: 1,
      state: 'draft',
      blocks: normalizeBlocks(input.blocks),
      createdByUserId: ctxTenant(ctx).dbUserId,
    });
  }

  return page;
}

async function ensureSystemPagesForProject(ctx: TRPCContext & { tenantId?: string; dbUserId?: string }, projectId: string) {
  const project = await requireProjectAccess(ctx, projectId);
  const impressum = await createPageWithInitialDraft(ctx, {
    projectId,
    path: '/impressum',
    title: 'Impressum',
    pageType: 'legal_impressum',
    blocks: createDefaultLegalBlocks('impressum', project.name),
  });
  const datenschutz = await createPageWithInitialDraft(ctx, {
    projectId,
    path: '/datenschutz',
    title: 'Datenschutz',
    pageType: 'legal_privacy',
    blocks: createDefaultLegalBlocks('datenschutz', project.name),
  });
  return { impressum, datenschutz };
}

export const websitePlatformRouter = createTRPCRouter({
  listProjects: protectedProcedure.query(async ({ ctx }) => {
    const { tenantId } = ctxTenant(ctx);
    return ctx.db.select().from(websiteProjects).where(eq(websiteProjects.ownerTenantId, tenantId)).orderBy(desc(websiteProjects.updatedAt));
  }),

  createProject: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(255), slug: z.string().min(2).max(120).regex(/^[a-z0-9-]+$/), layoutKey: z.string().default('praxis-classic') }))
    .mutation(async ({ ctx, input }) => {
      const { tenantId } = ctxTenant(ctx);
      const [existing] = await ctx.db
        .select({ id: websiteProjects.id })
        .from(websiteProjects)
        .where(eq(websiteProjects.ownerTenantId, tenantId))
        .limit(1);
      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Für diese Praxis existiert bereits eine Website.' });
      }

      const [tenant] = await ctx.db
        .select({ slug: tenants.slug, email: tenants.email, phone: tenants.phone, address: tenants.address, city: tenants.city, openingHours: tenants.openingHours })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);
      const defaultBlocks = createDefaultWebsiteBlocks({
        practiceName: input.name,
        tenantSlug: tenant?.slug,
        email: tenant?.email,
        phone: tenant?.phone,
        address: tenant?.address,
        city: tenant?.city,
        openingHours: tenant?.openingHours as DaySchedule[] | null,
      });
      const [project] = await ctx.db.insert(websiteProjects).values({
        ownerType: 'tenant', ownerTenantId: tenantId, name: input.name, slug: input.slug, layoutKey: input.layoutKey,
        status: 'draft',
        themeConfig: themeConfigSchema.parse({}),
        capabilities: capabilityConfigSchema.parse({ booking: { enabled: true, mode: 'pms', tenantSlug: tenant?.slug }, contactForm: { enabled: true, notifyEmail: tenant?.email } }),
      }).returning();
      await createPageWithInitialDraft(ctx, {
        projectId: project.id,
        path: '/',
        title: input.name,
        pageType: 'default',
        isHomepage: true,
        blocks: defaultBlocks,
      });
      await ensureSystemPagesForProject(ctx, project.id);
      return project;
    }),

  getProject: protectedProcedure.input(z.object({ projectId: z.string().uuid() })).query(async ({ ctx, input }) => requireProjectAccess(ctx, input.projectId)),

  updateProjectSettings: protectedProcedure.input(z.object({
    projectId: z.string().uuid(),
    name: z.string().min(1).max(255).optional(),
    layoutKey: z.string().optional(),
    themeConfig: themeConfigSchema.optional(),
    capabilities: capabilityConfigSchema.optional(),
    seoConfig: websiteProjectSeoSchema.partial().optional(),
    status: z.enum(['draft', 'published', 'archived']).optional(),
  })).mutation(async ({ ctx, input }) => {
    await requireProjectAccess(ctx, input.projectId);
    const { projectId, ...updates } = input;
    const [project] = await ctx.db.update(websiteProjects).set({ ...updates, updatedAt: new Date() }).where(eq(websiteProjects.id, projectId)).returning();
    return project;
  }),

  listPages: protectedProcedure.input(z.object({ projectId: z.string().uuid() })).query(async ({ ctx, input }) => {
    await requireProjectAccess(ctx, input.projectId);
    return ctx.db.select().from(websitePages).where(eq(websitePages.websiteProjectId, input.projectId)).orderBy(websitePages.path);
  }),

  ensureSystemPages: protectedProcedure.input(z.object({ projectId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    await ensureSystemPagesForProject(ctx, input.projectId);
    return ctx.db.select().from(websitePages).where(eq(websitePages.websiteProjectId, input.projectId)).orderBy(websitePages.path);
  }),

  createPage: protectedProcedure.input(z.object({ projectId: z.string().uuid(), path: z.string().min(1).max(255), title: z.string().min(1).max(255), pageType: z.enum(['default', 'legal_impressum', 'legal_privacy', 'landing', 'booking']).default('default') })).mutation(async ({ ctx, input }) => {
    await requireProjectAccess(ctx, input.projectId);
    const [page] = await ctx.db.insert(websitePages).values({ websiteProjectId: input.projectId, path: normalizeWebsitePath(input.path), title: input.title, pageType: input.pageType }).returning();
    await ctx.db.insert(websitePageRevisions).values({ websitePageId: page.id, version: 1, state: 'draft', blocks: [{ id: 'richtext-default', type: 'richText', props: { heading: input.title, html: '<p>Neuer Seiteninhalt</p>' } }], createdByUserId: ctxTenant(ctx).dbUserId });
    return page;
  }),

  getDraft: protectedProcedure.input(z.object({ pageId: z.string().uuid() })).query(async ({ ctx, input }) => {
    const [page] = await ctx.db.select({ projectId: websitePages.websiteProjectId }).from(websitePages).where(eq(websitePages.id, input.pageId)).limit(1);
    if (!page) throw new TRPCError({ code: 'NOT_FOUND' });
    await requireProjectAccess(ctx, page.projectId);
    const [revision] = await ctx.db.select().from(websitePageRevisions).where(and(eq(websitePageRevisions.websitePageId, input.pageId), eq(websitePageRevisions.state, 'draft'))).orderBy(desc(websitePageRevisions.createdAt)).limit(1);
    return revision ?? null;
  }),

  saveDraft: protectedProcedure.input(z.object({ pageId: z.string().uuid(), blocks: pageBlocksSchema })).mutation(async ({ ctx, input }) => {
    const [page] = await ctx.db.select({ projectId: websitePages.websiteProjectId }).from(websitePages).where(eq(websitePages.id, input.pageId)).limit(1);
    if (!page) throw new TRPCError({ code: 'NOT_FOUND' });
    await requireProjectAccess(ctx, page.projectId);
    const [latest] = await ctx.db.select({ version: websitePageRevisions.version }).from(websitePageRevisions).where(eq(websitePageRevisions.websitePageId, input.pageId)).orderBy(desc(websitePageRevisions.version)).limit(1);
    const [revision] = await ctx.db.insert(websitePageRevisions).values({ websitePageId: input.pageId, version: (latest?.version ?? 0) + 1, state: 'draft', blocks: normalizeBlocks(input.blocks), createdByUserId: ctxTenant(ctx).dbUserId }).returning();
    return revision;
  }),

  publishPage: protectedProcedure.input(z.object({ pageId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const [page] = await ctx.db.select({ projectId: websitePages.websiteProjectId }).from(websitePages).where(eq(websitePages.id, input.pageId)).limit(1);
    if (!page) throw new TRPCError({ code: 'NOT_FOUND' });
    await requireProjectAccess(ctx, page.projectId);
    const [draft] = await ctx.db.select().from(websitePageRevisions).where(and(eq(websitePageRevisions.websitePageId, input.pageId), eq(websitePageRevisions.state, 'draft'))).orderBy(desc(websitePageRevisions.createdAt)).limit(1);
    if (!draft) throw new TRPCError({ code: 'BAD_REQUEST', message: 'No draft to publish' });
    await ctx.db.update(websitePageRevisions).set({ state: 'draft' }).where(and(eq(websitePageRevisions.websitePageId, input.pageId), eq(websitePageRevisions.state, 'published')));
    const [published] = await ctx.db.update(websitePageRevisions).set({ state: 'published' }).where(eq(websitePageRevisions.id, draft.id)).returning();
    await ctx.db.update(websiteProjects).set({ status: 'published', publishedAt: new Date(), updatedAt: new Date() }).where(eq(websiteProjects.id, page.projectId));
    return published;
  }),

  listDomains: protectedProcedure.input(z.object({ projectId: z.string().uuid() })).query(async ({ ctx, input }) => {
    await requireProjectAccess(ctx, input.projectId);
    return ctx.db.select().from(websiteDomains).where(eq(websiteDomains.websiteProjectId, input.projectId));
  }),

  addDomain: protectedProcedure.input(z.object({ projectId: z.string().uuid(), domain: z.string().min(3).max(255) })).mutation(async ({ ctx, input }) => {
    await requireProjectAccess(ctx, input.projectId);
    const domain = normalizeWebsiteHost(input.domain);
    const [row] = await ctx.db.insert(websiteDomains).values({ websiteProjectId: input.projectId, domain, verificationToken: crypto.randomUUID(), status: 'verification_required' }).returning();
    return row;
  }),

  listAssets: protectedProcedure.input(z.object({ projectId: z.string().uuid() })).query(async ({ ctx, input }) => {
    await requireProjectAccess(ctx, input.projectId);
    return ctx.db.select().from(websiteAssets).where(eq(websiteAssets.websiteProjectId, input.projectId)).orderBy(desc(websiteAssets.createdAt));
  }),

  finalizeAsset: protectedProcedure.input(z.object({ projectId: z.string().uuid(), storageKey: z.string(), url: z.string(), mimeType: z.string(), sizeBytes: z.number().int().positive(), width: z.number().int().optional(), height: z.number().int().optional(), alt: z.string().optional() })).mutation(async ({ ctx, input }) => {
    await requireProjectAccess(ctx, input.projectId);
    const [asset] = await ctx.db.insert(websiteAssets).values({ websiteProjectId: input.projectId, storageKey: input.storageKey, url: input.url, mimeType: input.mimeType, sizeBytes: input.sizeBytes, width: input.width, height: input.height, alt: input.alt, createdByUserId: ctxTenant(ctx).dbUserId }).returning();
    return asset;
  }),

  listLeads: protectedProcedure.input(z.object({ projectId: z.string().uuid() })).query(async ({ ctx, input }) => {
    await requireProjectAccess(ctx, input.projectId);
    return ctx.db.select().from(websiteLeads).where(eq(websiteLeads.websiteProjectId, input.projectId)).orderBy(desc(websiteLeads.createdAt));
  }),
});

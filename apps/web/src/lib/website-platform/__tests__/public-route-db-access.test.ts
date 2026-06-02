// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  tenants,
  websiteDomains,
  websitePageRevisions,
  websitePages,
  websiteProjects,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { canView, getAccessInfo } from "@/lib/public-route/site-access";
import { resolveProjectByHostOrSlug, resolvePublishedWebsitePage } from "@/lib/website-platform/resolve-project";

process.env.JWT_SECRET = "test-secret-at-least-32-chars-long!!";
process.env.SMTP_HOST ??= "localhost";
process.env.SMTP_USER ??= "test-user";
process.env.SMTP_PASS ??= "test-pass";

let createTestDb!: (typeof import("@/server/__tests__/helpers"))["createTestDb"];
let seedTestTenant!: (typeof import("@/server/__tests__/helpers"))["seedTestTenant"];
type TestDb = Awaited<ReturnType<(typeof import("@/server/__tests__/helpers"))["createTestDb"]>>["db"];

type DomainStatus = "pending" | "verification_required" | "verified" | "active" | "failed";

let db: TestDb;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  ({ createTestDb, seedTestTenant } = await import("@/server/__tests__/helpers"));
  ({ db, cleanup } = await createTestDb());
}, 60_000);

afterAll(async () => {
  await cleanup?.();
});

async function seedTenantWebsiteProject(options: {
  websiteEnabled: boolean;
  previewToken?: string | null;
  tenantSlug?: string;
  projectSlug?: string;
}) {
  const tenantSlug = options.tenantSlug ?? `tenant-${randomUUID().slice(0, 8)}`;
  const projectSlug = options.projectSlug ?? `site-${randomUUID().slice(0, 8)}`;
  const previewToken = options.previewToken ?? null;

  const { tenant, user } = await seedTestTenant(db, {
    clerkId: `clerk_${randomUUID().slice(0, 8)}`,
    slug: tenantSlug,
  });

  await db
    .update(tenants)
    .set({ websiteEnabled: options.websiteEnabled, previewToken })
    .where(eq(tenants.id, tenant.id));

  const [project] = await db
    .insert(websiteProjects)
    .values({
      ownerType: "tenant",
      ownerTenantId: tenant.id,
      name: `Project ${projectSlug}`,
      slug: projectSlug,
      status: "published",
      previewToken,
    })
    .returning();

  const [page] = await db
    .insert(websitePages)
    .values({
      websiteProjectId: project.id,
      path: "/",
      title: "Homepage",
      isHomepage: true,
    })
    .returning();

  await db.insert(websitePageRevisions).values({
    websitePageId: page.id,
    version: 1,
    state: "published",
    blocks: [],
  });

  return { tenant, user, project };
}

async function attachDomain(projectId: string, domain: string, status: DomainStatus) {
  await db.insert(websiteDomains).values({
    websiteProjectId: projectId,
    domain,
    status,
  });
}

describe("public /site baseline access integration", () => {
  it("resolves and loads published tenant website pages with runtime DB handle for enabled tenants", async () => {
    const { tenant, project } = await seedTenantWebsiteProject({
      websiteEnabled: true,
      previewToken: null,
    });

    const resolvedBySlug = await resolveProjectByHostOrSlug({ slug: project.slug }, db);
    expect(resolvedBySlug).toBe(project.id);

    const page = await resolvePublishedWebsitePage({ projectId: project.id, path: "/" }, db);
    expect(page?.project.id).toBe(project.id);
    expect(page?.project.ownerTenantId).toBe(tenant.id);

    const access = await getAccessInfo(project.id, db);
    expect(access).toEqual({
      ownerType: "tenant",
      websiteEnabled: true,
      tenantId: tenant.id,
      previewToken: null,
    });
  });

  it("requires a valid preview token (or tenant membership) for disabled tenant sites", async () => {
    const { tenant, user, project } = await seedTenantWebsiteProject({
      websiteEnabled: false,
      previewToken: "preview-token-123",
    });

    const access = await getAccessInfo(project.id, db);
    expect(access).not.toBeNull();

    expect(
      await canView(access!, undefined, {
        database: db,
        userId: null,
      })
    ).toBe(false);

    expect(
      await canView(access!, "wrong-token", {
        database: db,
        userId: null,
      })
    ).toBe(false);

    expect(
      await canView(access!, "preview-token-123", {
        database: db,
        userId: null,
      })
    ).toBe(true);

    expect(
      await canView(access!, undefined, {
        database: db,
        userId: user.clerkId,
      })
    ).toBe(true);

    const publishedPage = await resolvePublishedWebsitePage({ projectId: project.id, path: "/" }, db);
    expect(publishedPage?.project.id).toBe(project.id);
    expect(publishedPage?.project.ownerTenantId).toBe(tenant.id);
  });
});

describe("custom-domain resolution integration", () => {
  it("resolves active domains and rejects inactive/unknown domains", async () => {
    const { project: activeProject } = await seedTenantWebsiteProject({
      websiteEnabled: true,
      tenantSlug: `active-${randomUUID().slice(0, 8)}`,
      projectSlug: `active-site-${randomUUID().slice(0, 8)}`,
    });

    const { project: inactiveProject } = await seedTenantWebsiteProject({
      websiteEnabled: true,
      tenantSlug: `inactive-${randomUUID().slice(0, 8)}`,
      projectSlug: `inactive-site-${randomUUID().slice(0, 8)}`,
    });

    await attachDomain(activeProject.id, "active.example.test", "active");
    await attachDomain(inactiveProject.id, "inactive.example.test", "verification_required");

    await expect(
      resolveProjectByHostOrSlug({ host: "active.example.test" }, db)
    ).resolves.toBe(activeProject.id);

    await expect(
      resolveProjectByHostOrSlug({ host: "inactive.example.test" }, db)
    ).resolves.toBeNull();

    await expect(
      resolveProjectByHostOrSlug({ host: "unknown.example.test" }, db)
    ).resolves.toBeNull();
  });
});

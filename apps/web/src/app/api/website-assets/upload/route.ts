import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { users, websiteAssets, websiteProjects } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

export const runtime = 'nodejs';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml']);
const MAX_BYTES = 12 * 1024 * 1024;
const querySchema = z.object({ projectId: z.string().uuid() });

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid project' }, { status: 400 });

  const [user] = await db.select({ id: users.id, tenantId: users.tenantId }).from(users).where(eq(users.clerkId, userId)).limit(1);
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const [project] = await db.select({ id: websiteProjects.id }).from(websiteProjects).where(and(eq(websiteProjects.id, parsed.data.projectId), eq(websiteProjects.ownerTenantId, user.tenantId))).limit(1);
  if (!project) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File too large' }, { status: 400 });

  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
  const safeName = `${randomUUID()}.${ext}`;
  const relDir = `/tenant-assets/website-projects/${project.id}`;
  const publicDir = path.join(process.cwd(), 'public', relDir);
  await mkdir(publicDir, { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(publicDir, safeName), bytes);

  const url = `${relDir}/${safeName}`;
  const [asset] = await db.insert(websiteAssets).values({
    websiteProjectId: project.id,
    storageKey: `local:${project.id}/${safeName}`,
    url,
    mimeType: file.type,
    sizeBytes: file.size,
    alt: typeof formData.get('alt') === 'string' ? String(formData.get('alt')) : undefined,
    createdByUserId: user.id,
  }).returning();

  return NextResponse.json({ asset });
}

import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';

const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  gif: 'image/gif',
  pdf: 'application/pdf',
};

type Params = Promise<{ path: string[] }>;

export async function GET(_req: NextRequest, { params }: { params: Params }) {
  const { path: segments } = await params;
  const relPath = segments.join('/');
  const ext = relPath.split('.').pop()?.toLowerCase() ?? '';
  const mimeType = MIME[ext];

  if (!mimeType) return new NextResponse(null, { status: 404 });

  const publicBase =
    process.env.ASSET_PUBLIC_DIR ?? path.join(process.cwd(), 'public');
  const absPath = path.resolve(
    path.join(publicBase, 'tenant-assets', relPath),
  );
  const baseDir = path.resolve(path.join(publicBase, 'tenant-assets'));

  if (!absPath.startsWith(baseDir + path.sep)) {
    return new NextResponse(null, { status: 403 });
  }

  try {
    const data = await readFile(absPath);
    return new NextResponse(data, {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}

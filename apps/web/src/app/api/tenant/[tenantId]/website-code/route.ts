import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db/client';
import { tenants, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

type Params = Promise<{ tenantId: string }>;

export async function POST(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { tenantId } = await params;

    // Verify user is owner/admin of this tenant
    const user = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, userId))
      .limit(1);

    if (!user.length || user[0].tenantId !== tenantId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Check if user is admin
    if (user[0].role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can update website code' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Invalid website code' },
        { status: 400 }
      );
    }

    // Validate code length (max 50KB)
    if (code.length > 50000) {
      return NextResponse.json(
        { error: 'Website code exceeds maximum size (50KB)' },
        { status: 400 }
      );
    }

    // Update tenant's custom website code
    await db
      .update(tenants)
      .set({ customWebsiteCode: code })
      .where(eq(tenants.id, tenantId));

    return NextResponse.json(
      { success: true, message: 'Website code updated' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating website code:', error);
    return NextResponse.json(
      { error: 'Failed to update website code' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { tenantId } = await params;

    // Verify user is admin of this tenant
    const user = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, userId))
      .limit(1);

    if (!user.length || user[0].tenantId !== tenantId || user[0].role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Clear custom website code
    await db
      .update(tenants)
      .set({ customWebsiteCode: null })
      .where(eq(tenants.id, tenantId));

    return NextResponse.json(
      { success: true, message: 'Custom website code removed' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting website code:', error);
    return NextResponse.json(
      { error: 'Failed to delete website code' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import {
  calendarAccessTokens,
  calendarAccessAudit,
  tenants,
  appointments,
  patients,
  owners,
  users,
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateAppointmentICS, validateICalFormat } from '@/lib/calendar/ics-generator';
import type { ICalEventData } from '@/lib/calendar/ics-generator';
import { getCachedICS, setCachedICS, initializeCacheInvalidation } from '@/lib/calendar/cache';

// Initialize cache invalidation system once per server instance
let cacheInitialized = false;

/**
 * GET /api/calendar/[tenantSlug]/[vetId].ics?token=[accessToken]
 *
 * Returns RFC 5545 compliant iCal feed for a veterinarian's appointments
 * - Read-only calendar feed
 * - Token-based access control
 * - Personal calendar (only this vet's appointments)
 * - Audits all accesses
 */
export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      tenantSlug: string;
      vetId: string;
    }>;
  }
) {
  let { tenantSlug, vetId } = await params;

  // Remove .ics extension if present (URL might be /api/calendar/demo/vetId.ics)
  if (vetId.endsWith('.ics')) {
    vetId = vetId.slice(0, -4);
  }

  // Get token from query string
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json(
      { error: 'Missing access token' },
      { status: 401 }
    );
  }

  const clientIp =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const userAgent = request.headers.get('user-agent') || '';

  try {
    // Initialize cache invalidation system once
    if (!cacheInitialized) {
      initializeCacheInvalidation();
      cacheInitialized = true;
    }

    // 1. Verify tenant exists
    const tenant = await db
      .select({ id: tenants.id, email: tenants.email, name: tenants.name, timezone: tenants.timezone, address: tenants.address, city: tenants.city })
      .from(tenants)
      .where(eq(tenants.slug, tenantSlug))
      .limit(1);

    if (!tenant.length) {
      await logAudit(null, null, vetId, 404, clientIp, userAgent, 0);
      return NextResponse.json(
        { error: 'Clinic not found' },
        { status: 404 }
      );
    }

    const tenantData = tenant[0];

    // 2. Verify vet exists in tenant
    const vet = await db
      .select({ id: users.id, title: users.title, firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(and(eq(users.id, vetId), eq(users.tenantId, tenantData.id)))
      .limit(1);

    if (!vet.length) {
      await logAudit(null, tenantData.id, vetId, 404, clientIp, userAgent, 0);
      return NextResponse.json(
        { error: 'Veterinarian not found' },
        { status: 404 }
      );
    }

    const vetData = vet[0];

    // 3. Verify access token
    const accessToken = await db
      .select({ id: calendarAccessTokens.id })
      .from(calendarAccessTokens)
      .where(
        and(
          eq(calendarAccessTokens.token, token),
          eq(calendarAccessTokens.tenantId, tenantData.id),
          eq(calendarAccessTokens.vetId, vetId),
          eq(calendarAccessTokens.isActive, true)
        )
      )
      .limit(1);

    if (!accessToken.length) {
      await logAudit(null, tenantData.id, vetId, 401, clientIp, userAgent, 0);
      return NextResponse.json(
        { error: 'Invalid or inactive access token' },
        { status: 401 }
      );
    }

    const tokenId = accessToken[0].id;

    // 4. Check cache first
    const cachedICS = getCachedICS(tenantData.id, vetId);
    if (cachedICS) {
      console.log('[Cache] Serving cached ICS for tenant', tenantData.id, 'vet', vetId);

      // Still log audit entry and update last used timestamp
      await logAudit(
        tokenId,
        tenantData.id,
        vetId,
        200,
        clientIp,
        userAgent,
        0 // Unknown count from cache
      );

      await db
        .update(calendarAccessTokens)
        .set({
          lastUsedAt: new Date(),
        })
        .where(eq(calendarAccessTokens.id, tokenId));

      return new NextResponse(cachedICS, {
        status: 200,
        headers: {
          'Content-Type': 'text/calendar; charset=utf-8',
          'Content-Disposition': `attachment; filename="${tenantSlug}-${vetId}.ics"`,
          'Cache-Control': 'max-age=900, public', // Cache for 15 minutes
          'Access-Control-Allow-Origin': '*',
          'X-Cache': 'HIT', // Indicate cache hit
        },
      });
    }

    // 5. Query appointments for this vet in next 12 months
    const now = new Date();
    const endDate = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

    const appointmentsData = await db
      .select({
        appointment: appointments,
        patient: patients,
        owner: owners,
      })
      .from(appointments)
      .innerJoin(patients, eq(appointments.patientId, patients.id))
      .innerJoin(owners, eq(patients.ownerId, owners.id))
      .where(
        and(
          eq(appointments.tenantId, tenantData.id),
          eq(appointments.vetId, vetId),
          // Only get future appointments or current/recently completed
          // Include scheduled, confirmed, completed (exclude cancelled, no-show)
          // Actually, let's include all for the feed, but mark cancelled ones
        )
      );

    const filteredAppointments = appointmentsData.filter(
      (a) => new Date(a.appointment.startTime) >= now && new Date(a.appointment.startTime) <= endDate
    );

    // 6. Generate iCal
    const events: ICalEventData[] = filteredAppointments.map((item) => ({
      appointment: item.appointment,
      patient: {
        ...item.patient,
        owner: item.owner,
      },
      veterinarian: vetData,
      clinicName: tenantData.name,
      clinicAddress: tenantData.address || undefined,
      clinicCity: tenantData.city || undefined,
      practiceTimezone: tenantData.timezone,
    }));

    const icsContent = generateAppointmentICS(
      events,
      tenantData.email,
      tenantSlug,
      tenantData.name
    );

    console.log('Generated ICS content:', {
      length: icsContent.length,
      startsWithBEGIN: icsContent.startsWith('BEGIN:VCALENDAR'),
      endsWithEND: icsContent.trim().endsWith('END:VCALENDAR'),
      preview: icsContent.substring(0, 200),
    });

    // Validate format
    if (!validateICalFormat(icsContent)) {
      console.log('ICS validation failed');
      await logAudit(
        tokenId,
        tenantData.id,
        vetId,
        500,
        clientIp,
        userAgent,
        0
      );
      return NextResponse.json(
        { error: 'Failed to generate valid iCal format', debug: { length: icsContent.length, preview: icsContent.substring(0, 100) } },
        { status: 500 }
      );
    }

    // 7. Store in cache for future requests
    setCachedICS(tenantData.id, vetId, icsContent);
    console.log('[Cache] Stored ICS in cache for tenant', tenantData.id, 'vet', vetId);

    // 8. Log audit entry
    await logAudit(
      tokenId,
      tenantData.id,
      vetId,
      200,
      clientIp,
      userAgent,
      filteredAppointments.length
    );

    // 9. Update last used timestamp
    await db
      .update(calendarAccessTokens)
      .set({
        lastUsedAt: new Date(),
      })
      .where(eq(calendarAccessTokens.id, tokenId));

    // 10. Return iCal feed
    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${tenantSlug}-${vetId}.ics"`,
        'Cache-Control': 'max-age=900, public', // Cache for 15 minutes
        'Access-Control-Allow-Origin': '*',
        'X-Cache': 'MISS', // Indicate cache miss (just generated)
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : '';
    console.error('Calendar ICS generation error:', {
      message: errorMessage,
      stack: errorStack,
      tenantSlug,
      vetId,
    });
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * Helper: Log access audit
 */
async function logAudit(
  tokenId: string | null,
  tenantId: string | null,
  vetId: string,
  httpStatus: number,
  ipAddress: string,
  userAgent: string,
  eventCount: number
) {
  try {
    if (!tenantId) return; // Skip if tenant doesn't exist

    await db.insert(calendarAccessAudit).values({
      tokenId: tokenId || null,
      tenantId,
      veterinarianId: vetId,
      accessedAt: new Date(),
      ipAddress,
      userAgent: userAgent.slice(0, 500), // Truncate to reasonable length
      eventCount,
      httpStatus,
    });
  } catch (error) {
    console.error('Failed to log calendar access audit:', error);
    // Don't fail the request if audit logging fails
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { websiteLeads, websiteProjects } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { checkRateLimit } from '@/lib/rateLimit';
import { getEmailProvider } from '@/lib/email/providers';

const leadSchema = z.object({
  websiteProjectId: z.string().uuid(),
  sourcePagePath: z.string().default('/'),
  name: z.string().min(1).max(120),
  email: z.string().email().max(180),
  phone: z.string().max(80).optional(),
  message: z.string().min(1).max(5000),
  consent: z.union([z.literal('true'), z.literal(true)]).optional(),
});

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
  if (!checkRateLimit(`website-leads:${ip}`, true)) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  const contentType = request.headers.get('content-type') ?? '';
  const raw = contentType.includes('application/json')
    ? await request.json()
    : Object.fromEntries((await request.formData()).entries());
  const parsed = leadSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const [project] = await db
    .select({ id: websiteProjects.id, name: websiteProjects.name, capabilities: websiteProjects.capabilities })
    .from(websiteProjects)
    .where(eq(websiteProjects.id, parsed.data.websiteProjectId))
    .limit(1);
  if (!project) return NextResponse.json({ ok: false }, { status: 404 });

  await db.insert(websiteLeads).values({
    websiteProjectId: parsed.data.websiteProjectId,
    sourcePagePath: parsed.data.sourcePagePath,
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    message: parsed.data.message,
    consent: Boolean(parsed.data.consent),
    metadata: { ipAddress: ip, userAgent: request.headers.get('user-agent'), referrer: request.headers.get('referer') },
  });

  const notifyEmail = (project.capabilities as { contactForm?: { notifyEmail?: string } } | null)?.contactForm?.notifyEmail;
  if (notifyEmail) {
    try {
      const from = process.env.SMTP_FROM ?? 'noreply@example.com';
      await getEmailProvider().send({
        from: `${project.name} Website <${from}>`,
        to: notifyEmail,
        subject: `Neue Website-Anfrage: ${parsed.data.name}`,
        text: [
          `Neue Kontaktanfrage über Ihre Praxis-Website.`,
          ``,
          `Name: ${parsed.data.name}`,
          `E-Mail: ${parsed.data.email}`,
          parsed.data.phone ? `Telefon: ${parsed.data.phone}` : null,
          ``,
          `Nachricht:`,
          parsed.data.message,
        ].filter(Boolean).join('\n'),
      });
    } catch {
      // Email is best-effort; lead is already stored
    }
  }

  if (contentType.includes('application/json')) return NextResponse.json({ ok: true });
  return NextResponse.redirect(new URL(`${parsed.data.sourcePagePath}?lead=success`, request.url), { status: 303 });
}

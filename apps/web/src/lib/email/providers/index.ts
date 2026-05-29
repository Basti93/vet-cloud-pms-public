import type { EmailProvider } from '../types';
import { SmtpProvider, createSmtpProvider } from './smtp';
import { db } from '@/lib/db/client';
import { emailSettings, systemLogs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { decryptSecret } from '@/lib/crypto';

export function getEmailProvider(): EmailProvider {
  return createSmtpProvider();
}

export type TenantProviderResult = {
  provider: EmailProvider;
  from: string | null;
};

export async function getProviderForTenant(tenantId?: string | null): Promise<TenantProviderResult> {
  if (tenantId) {
    try {
      const [settings] = await db
        .select()
        .from(emailSettings)
        .where(eq(emailSettings.tenantId, tenantId))
        .limit(1);

      if (settings?.smtpEnabled && settings.smtpHost && settings.smtpUser && settings.smtpPassEncrypted) {
        const pass = decryptSecret(settings.smtpPassEncrypted);
        const fromEmail = settings.smtpFromEmail ?? process.env.SMTP_FROM ?? 'noreply@example.com';
        const from = settings.smtpFromName ? `${settings.smtpFromName} <${fromEmail}>` : fromEmail;

        return {
          provider: new SmtpProvider({
            host: settings.smtpHost,
            port: settings.smtpPort ?? 465,
            user: settings.smtpUser,
            pass,
            fromEmail,
          }),
          from,
        };
      }
    } catch (error) {
      console.error('[email] getProviderForTenant error for tenant', tenantId, '— falling back to system SMTP:', error);
      try {
        await db.insert(systemLogs).values({
          level: 'error',
          category: 'email',
          eventType: 'tenant_smtp_resolve_failed',
          tenantId: tenantId ?? null,
          message: `Failed to resolve tenant SMTP provider, falling back to system SMTP: ${String(error)}`,
          errorStack: error instanceof Error ? error.stack ?? null : null,
        });
      } catch {
        // never throw — email delivery takes priority
      }
    }
  }

  return { provider: getEmailProvider(), from: null };
}

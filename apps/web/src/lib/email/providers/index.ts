import type { EmailProvider } from '../types';
import { SmtpProvider, createSmtpProvider } from './smtp';
import { db } from '@/lib/db/client';
import { emailSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { decryptSecret } from '@/lib/crypto';

export function getEmailProvider(): EmailProvider {
  const provider = process.env.EMAIL_PROVIDER ?? 'smtp';

  switch (provider) {
    case 'smtp':
      return createSmtpProvider();

    default:
      throw new Error(`Unknown email provider: ${provider}`);
  }
}

export type TenantProviderResult = {
  provider: EmailProvider;
  from: string | null;
};

export async function getProviderForTenant(tenantId?: string | null): Promise<TenantProviderResult> {
  if (tenantId) {
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
  }

  return { provider: getEmailProvider(), from: null };
}

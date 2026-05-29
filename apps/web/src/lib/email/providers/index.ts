import type { EmailProvider } from '../types';
import { createSmtpProvider } from './smtp';

export function getEmailProvider(): EmailProvider {
  const provider = process.env.EMAIL_PROVIDER ?? 'smtp';

  switch (provider) {
    case 'smtp':
      return createSmtpProvider();

    default:
      throw new Error(`Unknown email provider: ${provider}`);
  }
}

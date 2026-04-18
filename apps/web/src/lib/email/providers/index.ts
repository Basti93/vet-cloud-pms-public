/**
 * Email Provider Factory
 * Creates the appropriate email provider based on environment
 */

import type { EmailProvider } from '../types';
import { createResendProvider } from './resend';

// Add imports for other providers here when available:
// import { createSendGridProvider } from './sendgrid';
// import { createSESProvider } from './aws-ses';

/**
 * Get the configured email provider
 * Can be switched via EMAIL_PROVIDER environment variable
 */
export function getEmailProvider(): EmailProvider {
  const provider = process.env.EMAIL_PROVIDER || 'resend';

  switch (provider) {
    case 'resend':
      return createResendProvider();

    // Add other providers here:
    // case 'sendgrid':
    //   return createSendGridProvider();
    // case 'aws-ses':
    //   return createSESProvider();

    default:
      throw new Error(`Unknown email provider: ${provider}`);
  }
}

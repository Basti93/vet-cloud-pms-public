/**
 * Email Service
 * High-level service for sending emails with template support
 * Abstracts the underlying provider implementation
 */

import { getEmailProvider } from './providers';
import type { EmailService, SendEmailOptions, EmailTemplate, EmailMetrics } from './types';

/**
 * Create an email service instance
 * Uses the configured provider internally
 */
export function createEmailService(): EmailService {
  const provider = getEmailProvider();

  return {
    async send(options: SendEmailOptions) {
      try {
        const result = await provider.send(options);
        return {
          success: true,
          messageId: result.messageId,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Email send failed:', message);
        return {
          success: false,
          error: message,
        };
      }
    },

    async sendTemplate(template: EmailTemplate, to: string, variables: Record<string, string>, from?: string) {
      try {
        const html = template.getHtml(variables);
        const result = await provider.send({
          to,
          from,
          subject: template.subject,
          html,
        });
        return {
          success: true,
          messageId: result.messageId,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Template email send failed:', message);
        return {
          success: false,
          error: message,
        };
      }
    },

    async getMetrics() {
      try {
        return await provider.getMetrics?.();
      } catch (error) {
        console.error('Failed to fetch metrics:', error);
        return null;
      }
    },

    getProviderName() {
      return provider.name;
    },
  };
}

// Singleton instance for use throughout the app
let emailService: EmailService | null = null;

/**
 * Get the email service singleton
 */
export function getEmailService(): EmailService {
  if (!emailService) {
    emailService = createEmailService();
  }
  return emailService;
}

/**
 * Helper for sending simple emails
 */
export async function sendEmail(options: SendEmailOptions) {
  const service = getEmailService();
  return service.send(options);
}

/**
 * Helper for sending template-based emails
 */
export async function sendTemplateEmail(
  template: EmailTemplate,
  to: string,
  variables: Record<string, string>,
  from?: string
) {
  const service = getEmailService();
  return service.sendTemplate(template, to, variables, from);
}

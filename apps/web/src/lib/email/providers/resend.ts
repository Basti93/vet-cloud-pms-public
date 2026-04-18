/**
 * Resend Email Provider
 * Implementation of EmailProvider interface using Resend service
 */

import { Resend } from 'resend';
import type { EmailProvider, SendEmailOptions, EmailMetrics } from '../types';

const DEFAULT_FROM_EMAIL = 'noreply@example.com';

export class ResendProvider implements EmailProvider {
  name = 'resend';
  private client: Resend;
  private fromEmail: string;

  constructor(apiKey: string, fromEmail: string = DEFAULT_FROM_EMAIL) {
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is required');
    }
    this.client = new Resend(apiKey);
    this.fromEmail = fromEmail;
  }

  async send(options: SendEmailOptions): Promise<{ messageId: string }> {
    try {
      const response = await this.client.emails.send({
        from: options.from || this.fromEmail,
        to: options.to,
        subject: options.subject,
        html: options.html,
        replyTo: options.replyTo,
      });

      if (response.error) {
        throw new Error(`Resend error: ${response.error.message}`);
      }

      return {
        messageId: response.data?.id || 'unknown',
      };
    } catch (error) {
      console.error('Error sending email via Resend:', error);
      throw error;
    }
  }

  async getMetrics(): Promise<EmailMetrics | null> {
    // Resend doesn't provide a simple metrics API in the SDK
    // You would need to use their analytics dashboard or call their API directly
    // For now, return null - can be implemented later
    console.log('Note: Resend metrics API not yet implemented. Check dashboard at https://resend.com');
    return null;
  }
}

/**
 * Factory function to create Resend provider
 */
export function createResendProvider(): ResendProvider {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || DEFAULT_FROM_EMAIL;
  return new ResendProvider(apiKey, fromEmail);
}

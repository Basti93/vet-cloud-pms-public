/**
 * Email Service Types & Interfaces
 * Provider-agnostic definitions for email sending
 */

export interface SendEmailOptions {
  to: string;
  from?: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export interface EmailTemplate {
  name: 'confirmation' | 'cancellation' | 'reminder';
  subject: string;
  getHtml(variables: Record<string, string>): string;
}

export interface EmailProvider {
  name: string;
  send(options: SendEmailOptions): Promise<{ messageId: string }>;
  getMetrics?(): Promise<EmailMetrics | null>;
}

export interface EmailMetrics {
  sent: number;
  delivered: number;
  failed: number;
  bounced: number;
  opens?: number;
  clicks?: number;
}

export interface EmailService {
  send(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }>;
  sendTemplate(
    template: EmailTemplate,
    to: string,
    variables: Record<string, string>,
    from?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }>;
  getMetrics(): Promise<EmailMetrics | null>;
  getProviderName(): string;
}

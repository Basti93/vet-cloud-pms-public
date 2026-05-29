import nodemailer from 'nodemailer';
import type { EmailProvider, SendEmailOptions, EmailMetrics } from '../types';

export type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromEmail: string;
};

export class SmtpProvider implements EmailProvider {
  name = 'smtp';
  private transporter: nodemailer.Transporter;
  private fromEmail: string;

  constructor(config: SmtpConfig) {
    this.fromEmail = config.fromEmail;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      requireTLS: config.port === 587,
      pool: true,
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });
  }

  async send(options: SendEmailOptions): Promise<{ messageId: string }> {
    const info = await this.transporter.sendMail({
      from: options.from ?? this.fromEmail,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo,
    });
    return { messageId: info.messageId };
  }

  async getMetrics(): Promise<EmailMetrics | null> {
    return null;
  }
}

export function createSmtpProvider(): SmtpProvider {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error('Missing required SMTP env vars: SMTP_HOST, SMTP_USER, SMTP_PASS');
  }

  return new SmtpProvider({
    host,
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    user,
    pass,
    fromEmail: process.env.SMTP_FROM ?? 'noreply@example.com',
  });
}

import type { EmailProvider, SendEmailOptions } from "../../types";

export interface SentEmail {
  to: string;
  from?: string;
  subject: string;
  text?: string;
  html?: string;
}

export interface InMemoryProvider {
  provider: EmailProvider;
  sent: SentEmail[];
  reset(): void;
}

export function createInMemoryProvider(opts?: { failOnSend?: boolean }): InMemoryProvider {
  const sent: SentEmail[] = [];
  const provider: EmailProvider = {
    name: "in-memory",
    async send(options: SendEmailOptions) {
      if (opts?.failOnSend) {
        throw new Error("in-memory provider: failOnSend=true");
      }
      sent.push({
        to: options.to,
        from: options.from,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });
      return { messageId: `test-${sent.length}` };
    },
  };
  return { provider, sent, reset: () => sent.splice(0) };
}

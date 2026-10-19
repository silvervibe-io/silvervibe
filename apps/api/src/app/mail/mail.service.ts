import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

export type SendMailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type SendMailResult = {
  sent: boolean;
  error?: string;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;

  constructor() {
    const apiKey = process.env['RESEND_API_KEY']?.trim();
    this.from = stripEnvQuotes(
      process.env['EMAIL_FROM']?.trim() ||
        'VibeStandup <onboarding@resend.dev>',
    );
    this.resend = apiKey ? new Resend(apiKey) : null;
    if (!this.resend) {
      this.logger.warn(
        'RESEND_API_KEY is not set; outbound email is disabled (invite links still work)',
      );
    } else {
      this.logger.log(`Outbound email enabled (from=${this.from})`);
    }
  }

  isConfigured(): boolean {
    return this.resend !== null;
  }

  async send(input: SendMailInput): Promise<SendMailResult> {
    if (!this.resend) {
      return { sent: false, error: 'RESEND_API_KEY is not set' };
    }

    const { data, error } = await this.resend.emails.send({
      from: this.from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    });

    if (error) {
      this.logger.error(
        `Failed to send mail to ${input.to} from ${this.from}: ${error.message}`,
      );
      return { sent: false, error: error.message };
    }

    this.logger.log(`Sent mail to ${input.to} (id=${data?.id ?? 'unknown'})`);
    return { sent: true };
  }

  async sendTeamInvite(params: {
    to: string;
    teamName: string;
    acceptUrl: string;
    expiresAt: Date;
  }): Promise<SendMailResult> {
    const expires = params.expiresAt.toUTCString();
    const subject = `You're invited to ${params.teamName} on VibeStandup`;
    const text = [
      `You've been invited to join ${params.teamName} on VibeStandup.`,
      '',
      `Open this link to accept (sign in with ${params.to}):`,
      params.acceptUrl,
      '',
      `This invite expires on ${expires}.`,
    ].join('\n');
    const html = `
      <p>You've been invited to join <strong>${escapeHtml(params.teamName)}</strong> on VibeStandup.</p>
      <p><a href="${escapeHtml(params.acceptUrl)}">Accept invite</a></p>
      <p>Sign in with <strong>${escapeHtml(params.to)}</strong>. This invite expires on ${escapeHtml(expires)}.</p>
      <p style="color:#666;font-size:12px;word-break:break-all;">${escapeHtml(params.acceptUrl)}</p>
    `.trim();

    return this.send({ to: params.to, subject, html, text });
  }
}

function stripEnvQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

import nodemailer, { Transporter } from 'nodemailer';

import { logger } from '@/utils/logger';

interface EmailPayload {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export class EmailService {
  private static transporter: Transporter | null = null;
  private static transporterVerified = false;

  private static isEmailEnabled(): boolean {
    return (process.env.EMAIL_ENABLED || 'true').toLowerCase() !== 'false';
  }

  private static getFromAddress(): string {
    return process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@localhost';
  }

  private static getAppBaseUrl(): string {
    return (process.env.APP_BASE_URL || process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
  }

  private static createTransporter(): Transporter {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = (process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const requireTls = (process.env.SMTP_REQUIRE_TLS || 'true').toLowerCase() !== 'false';

    if (!host || !user || !pass || Number.isNaN(port)) {
      throw new Error('SMTP configuration is incomplete (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS are required)');
    }

    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      tls: {
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2'
      },
      requireTLS: requireTls
    });
  }

  private static getTransporter(): Transporter {
    if (!this.transporter) {
      this.transporter = this.createTransporter();
      this.transporterVerified = false;
    }

    return this.transporter;
  }

  private static async ensureTransporterVerified(): Promise<void> {
    if (this.transporterVerified) {
      return;
    }

    const transporter = this.getTransporter();
    await transporter.verify();
    this.transporterVerified = true;
  }

  private static async sendEmail(payload: EmailPayload): Promise<void> {
    if (!this.isEmailEnabled()) {
      logger.warn('Email delivery is disabled by EMAIL_ENABLED=false');
      return;
    }

    const transporter = this.getTransporter();
    await this.ensureTransporterVerified();

    const info = await transporter.sendMail({
      from: this.getFromAddress(),
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html
    });

    logger.info(`Email sent successfully: ${info.messageId} -> ${payload.to}`);
  }

  static async sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
    const resetUrl = `${this.getAppBaseUrl()}/reset-password?token=${encodeURIComponent(resetToken)}`;
    const subject = 'Reset your Visio Health password';
    const text = [
      'You requested a password reset for your Visio Health account.',
      '',
      `Reset your password using this link: ${resetUrl}`,
      '',
      'This link expires in 1 hour.',
      'If you did not request this reset, you can safely ignore this email.'
    ].join('\n');
    const html = [
      '<p>You requested a password reset for your Visio Health account.</p>',
      `<p><a href="${resetUrl}">Reset your password</a></p>`,
      '<p>This link expires in 1 hour.</p>',
      '<p>If you did not request this reset, you can safely ignore this email.</p>'
    ].join('');

    await this.sendEmail({
      to: email,
      subject,
      text,
      html
    });
  }
}

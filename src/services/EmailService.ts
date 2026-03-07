import nodemailer, { Transporter } from 'nodemailer';

import { logger } from '@/utils/logger';

interface EmailPayload {
  to: string;
  subject: string;
  text: string;
  html: string;
}

interface AppointmentReminderDetails {
  clientName?: string;
  appointmentDate: string;
  appointmentTime: string;
  location?: string;
  practitionerName?: string;
  notes?: string;
  subject?: string;
  message?: string;
}

interface BillingInvoiceDetails {
  clientName?: string;
  invoiceNumber?: string;
  totalAmount: number;
  currency?: string;
  dueDate?: string;
  summary?: string;
  subject?: string;
  message?: string;
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

  static async sendAppointmentReminder(
    email: string,
    appointmentDetails: AppointmentReminderDetails
  ): Promise<void> {
    const {
      clientName,
      appointmentDate,
      appointmentTime,
      location,
      practitionerName,
      notes,
      subject,
      message
    } = appointmentDetails;

    const recipientName = clientName?.trim() || 'Client';
    const normalizedSubject = subject?.trim() || `Appointment Reminder - ${appointmentDate} at ${appointmentTime}`;
    const customMessage = message?.trim();

    const text = [
      `Hi ${recipientName},`,
      '',
      'This is a reminder for your upcoming appointment.',
      `Date: ${appointmentDate}`,
      `Time: ${appointmentTime}`,
      location ? `Location: ${location}` : null,
      practitionerName ? `Provider: ${practitionerName}` : null,
      notes ? `Notes: ${notes}` : null,
      customMessage ? `Message: ${customMessage}` : null,
      '',
      'If you need to reschedule, please contact the clinic as soon as possible.',
      '',
      'Thank you,',
      'Visio Health'
    ]
      .filter(Boolean)
      .join('\n');

    const html = [
      `<p>Hi ${recipientName},</p>`,
      '<p>This is a reminder for your upcoming appointment.</p>',
      '<ul>',
      `<li><strong>Date:</strong> ${appointmentDate}</li>`,
      `<li><strong>Time:</strong> ${appointmentTime}</li>`,
      location ? `<li><strong>Location:</strong> ${location}</li>` : '',
      practitionerName ? `<li><strong>Provider:</strong> ${practitionerName}</li>` : '',
      notes ? `<li><strong>Notes:</strong> ${notes}</li>` : '',
      '</ul>',
      customMessage ? `<p><strong>Message:</strong> ${customMessage}</p>` : '',
      '<p>If you need to reschedule, please contact the clinic as soon as possible.</p>',
      '<p>Thank you,<br/>Visio Health</p>'
    ].join('');

    await this.sendEmail({
      to: email,
      subject: normalizedSubject,
      text,
      html
    });
  }

  static async sendBillingInvoice(
    email: string,
    invoiceDetails: BillingInvoiceDetails
  ): Promise<void> {
    const {
      clientName,
      invoiceNumber,
      totalAmount,
      currency = 'CAD',
      dueDate,
      summary,
      subject,
      message
    } = invoiceDetails;

    const recipientName = clientName?.trim() || 'Client';
    const safeAmount = Number.isFinite(totalAmount) ? totalAmount : 0;
    const formattedAmount = new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency
    }).format(safeAmount);
    const normalizedInvoiceNumber = invoiceNumber?.trim() || 'N/A';
    const normalizedSubject = subject?.trim() || `Invoice ${normalizedInvoiceNumber} - ${formattedAmount}`;
    const customMessage = message?.trim();

    const text = [
      `Hi ${recipientName},`,
      '',
      'Your invoice is ready.',
      `Invoice Number: ${normalizedInvoiceNumber}`,
      `Amount Due: ${formattedAmount}`,
      dueDate ? `Due Date: ${dueDate}` : null,
      summary ? `Summary: ${summary}` : null,
      customMessage ? `Message: ${customMessage}` : null,
      '',
      'Please contact the clinic if you have any billing questions.',
      '',
      'Thank you,',
      'Visio Health'
    ]
      .filter(Boolean)
      .join('\n');

    const html = [
      `<p>Hi ${recipientName},</p>`,
      '<p>Your invoice is ready.</p>',
      '<ul>',
      `<li><strong>Invoice Number:</strong> ${normalizedInvoiceNumber}</li>`,
      `<li><strong>Amount Due:</strong> ${formattedAmount}</li>`,
      dueDate ? `<li><strong>Due Date:</strong> ${dueDate}</li>` : '',
      summary ? `<li><strong>Summary:</strong> ${summary}</li>` : '',
      '</ul>',
      customMessage ? `<p><strong>Message:</strong> ${customMessage}</p>` : '',
      '<p>Please contact the clinic if you have any billing questions.</p>',
      '<p>Thank you,<br/>Visio Health</p>'
    ].join('');

    await this.sendEmail({
      to: email,
      subject: normalizedSubject,
      text,
      html
    });
  }

  static async sendFollowUp(email: string, subject: string, message: string): Promise<void> {
    const safeSubject = subject.trim() || 'Clinic Follow-up';
    const safeMessage = message.trim() || 'Thank you for visiting our clinic.';

    const text = [
      safeMessage,
      '',
      'Best regards,',
      'Visio Health'
    ].join('\n');

    const html = [
      `<p>${safeMessage.replace(/\n/g, '<br/>')}</p>`,
      '<p>Best regards,<br/>Visio Health</p>'
    ].join('');

    await this.sendEmail({
      to: email,
      subject: safeSubject,
      text,
      html
    });
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

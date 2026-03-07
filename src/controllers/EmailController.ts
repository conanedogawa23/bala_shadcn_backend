import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { EmailService } from '@/services/EmailService';

const isValidEmail = (value: string): boolean => /\S+@\S+\.\S+/.test(value);

export class EmailController {
  static sendAppointmentReminder = asyncHandler(async (req: Request, res: Response) => {
    const {
      to,
      clientName,
      appointmentDate,
      appointmentTime,
      location,
      practitionerName,
      notes,
      subject,
      message
    } = req.body as {
      to?: string;
      clientName?: string;
      appointmentDate?: string;
      appointmentTime?: string;
      location?: string;
      practitionerName?: string;
      notes?: string;
      subject?: string;
      message?: string;
    };

    if (!to || !isValidEmail(to)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'A valid recipient email is required'
        }
      });
    }

    if (!appointmentDate || !appointmentTime) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Appointment date and time are required'
        }
      });
    }

    await EmailService.sendAppointmentReminder(to, {
      clientName,
      appointmentDate,
      appointmentTime,
      location,
      practitionerName,
      notes,
      subject,
      message
    });

    return res.status(200).json({
      success: true,
      message: 'Appointment reminder email sent successfully'
    });
  });

  static sendBillingInvoice = asyncHandler(async (req: Request, res: Response) => {
    const {
      to,
      clientName,
      invoiceNumber,
      totalAmount,
      currency,
      dueDate,
      summary,
      subject,
      message
    } = req.body as {
      to?: string;
      clientName?: string;
      invoiceNumber?: string;
      totalAmount?: number;
      currency?: string;
      dueDate?: string;
      summary?: string;
      subject?: string;
      message?: string;
    };

    if (!to || !isValidEmail(to)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'A valid recipient email is required'
        }
      });
    }

    if (typeof totalAmount !== 'number' || Number.isNaN(totalAmount) || totalAmount < 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'A valid totalAmount is required'
        }
      });
    }

    await EmailService.sendBillingInvoice(to, {
      clientName,
      invoiceNumber,
      totalAmount,
      currency,
      dueDate,
      summary,
      subject,
      message
    });

    return res.status(200).json({
      success: true,
      message: 'Invoice email sent successfully'
    });
  });

  static sendFollowUp = asyncHandler(async (req: Request, res: Response) => {
    const {
      to,
      subject,
      message
    } = req.body as {
      to?: string;
      subject?: string;
      message?: string;
    };

    if (!to || !isValidEmail(to)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'A valid recipient email is required'
        }
      });
    }

    if (!subject?.trim() || !message?.trim()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Subject and message are required'
        }
      });
    }

    await EmailService.sendFollowUp(to, subject, message);

    return res.status(200).json({
      success: true,
      message: 'Follow-up email sent successfully'
    });
  });
}

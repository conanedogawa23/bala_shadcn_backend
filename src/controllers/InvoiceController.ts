import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { InvoiceService } from '../services/InvoiceService';
import { ClinicService } from '../services/ClinicService';

export class InvoiceController {
  /**
   * Generate invoices for a date range
   * GET /api/v1/invoices/generate
   */
  static getInvoicesForDateRange = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { startDate, endDate, clinicName, format } = req.query;

    if (!startDate || !endDate) {
      res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
      return;
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      res.status(400).json({
        success: false,
        message: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DD)'
      });
      return;
    }

    // Validate clinic if provided
    if (clinicName) {
      // TODO: Replace with proper clinic validation
      // const validClinics = await ClinicService.getRetainedClinics();
      // if (!validClinics.find((c: any) => c.clinicName === clinicName)) {
      //   res.status(400).json({
      //     success: false,
      //     message: 'Invalid clinic name'
      //   });
      //   return;
      // }
    }

    const invoices = await InvoiceService.generateInvoicesForDateRange(
      start,
      end,
      clinicName as string | undefined
    );

    if (format === 'html') {
      // Return HTML for viewing
      const htmlInvoices = await Promise.all(
        invoices.map(invoice => InvoiceService.generateInvoiceHtml(invoice))
      );
      const combinedHtml = htmlInvoices.join('<div style="page-break-after: always;"></div>');
      res.setHeader('Content-Type', 'text/html');
      res.send(combinedHtml);
      return;
    }

    // Return JSON by default
    res.json({
      success: true,
      count: invoices.length,
      invoices
    });
  });

  /**
   * Generate single invoice by order ID
   * GET /api/v1/invoices/:orderId
   */
  static getInvoiceByOrderId = asyncHandler(async (req: Request, res: Response) => {
    const { orderId } = req.params;
    const { format } = req.query;

    // Implementation would fetch order and generate invoice
    res.json({
      success: true,
      message: 'Invoice generation endpoint'
    });
  });

  /**
   * Generate HTML preview for invoice
   * POST /api/v1/invoices/preview
   */
  static getInvoicePreview = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { startDate, endDate, clinicName } = req.body;

    if (!startDate || !endDate) {
      res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    const invoices = await InvoiceService.generateInvoicesForDateRange(
      start,
      end,
      clinicName
    );

    if (invoices.length === 0) {
      res.json({
        success: true,
        message: 'No invoices found for the specified date range',
        count: 0,
        html: ''
      });
      return;
    }

    const htmlInvoices = await Promise.all(
      invoices.map(invoice => InvoiceService.generateInvoiceHtml(invoice))
    );

    const combinedHtml = htmlInvoices.join(
      '<div style="page-break-after: always; margin-top: 20px; padding-top: 20px; border-top: 1px solid black;"></div>'
    );

    res.json({
      success: true,
      count: invoices.length,
      html: combinedHtml
    });
  });

  /**
   * Download invoices as HTML file
   * GET /api/v1/invoices/download
   */
  static downloadInvoices = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { startDate, endDate, clinicName } = req.query;

    if (!startDate || !endDate) {
      res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
      return;
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    const invoices = await InvoiceService.generateInvoicesForDateRange(
      start,
      end,
      clinicName as string | undefined
    );

    if (invoices.length === 0) {
      res.status(404).json({
        success: false,
        message: 'No invoices found for the specified date range'
      });
      return;
    }

    const htmlInvoices = await Promise.all(
      invoices.map(invoice => InvoiceService.generateInvoiceHtml(invoice))
    );

    const combinedHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoices - ${startDate} to ${endDate}</title>
</head>
<body>
  ${htmlInvoices.join('<div style="page-break-after: always;"></div>')}
</body>
</html>
    `;

    const filename = `invoices_${Date.now()}.html`;
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(combinedHtml);
  });
}

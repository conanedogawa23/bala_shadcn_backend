import express from 'express';
import { InvoiceController } from '../controllers/InvoiceController';

const router = express.Router();

/**
 * GET /api/v1/invoices/generate
 * Generate invoices for a date range
 * Query params: startDate, endDate, clinicName (optional), format (optional: json|html)
 */
router.get('/generate', InvoiceController.getInvoicesForDateRange);

/**
 * GET /api/v1/invoices/download
 * Download invoices as HTML file
 * Query params: startDate, endDate, clinicName (optional)
 */
router.get('/download', InvoiceController.downloadInvoices);

/**
 * POST /api/v1/invoices/preview
 * Get HTML preview of invoices
 * Body: { startDate, endDate, clinicName (optional) }
 */
router.post('/preview', InvoiceController.getInvoicePreview);

/**
 * GET /api/v1/invoices/:orderId
 * Generate invoice for specific order
 * Query params: format (optional: json|html)
 */
router.get('/:orderId', InvoiceController.getInvoiceByOrderId);

export default router;

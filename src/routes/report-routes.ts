import { Router } from 'express';
import { ReportController } from '../controllers/ReportController';
import { requireClinicAccess } from '../middleware/authMiddleware';

const router = Router();

/**
 * TEMPORARILY PUBLIC: Report routes for development and testing
 * TODO: Re-enable authentication when JWT system is fully implemented
 */

// Get all available reports (with optional clinic filter)
router.get('/', ReportController.getAvailableReports);
router.get('/:clinicName/available', requireClinicAccess('clinicName'), ReportController.getAvailableReports);

// Client statistics (aggregated, no data transfer)
router.get('/:clinicName/client-statistics', requireClinicAccess('clinicName'), ReportController.getClientStatistics);

// Account Summary Reports (with clinic as query param or path param)
router.get('/account-summary', requireClinicAccess('clinicName'), ReportController.getAccountSummary);
router.get('/:clinicName/account-summary', requireClinicAccess('clinicName'), ReportController.getAccountSummary);

// Payment Summary by Day Range
router.get('/:clinicName/payment-summary', requireClinicAccess('clinicName'), ReportController.getPaymentSummary);

// Time Sheet Report
router.get('/:clinicName/timesheet', requireClinicAccess('clinicName'), ReportController.getTimesheetReport);

// Order Status Report
router.get('/:clinicName/order-status', requireClinicAccess('clinicName'), ReportController.getOrderStatusReport);

// Co Pay Summary Report (Renamed from Sales Refund Summary)
router.get('/:clinicName/copay-summary', requireClinicAccess('clinicName'), ReportController.getCoPaySummary);

// Marketing Budget Summary Report (Renamed from Shoe Allowance Summary)
router.get('/:clinicName/marketing-budget', requireClinicAccess('clinicName'), ReportController.getMarketingBudgetSummary);

export default router;

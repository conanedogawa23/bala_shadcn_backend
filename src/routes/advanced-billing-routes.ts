import { Router } from 'express';
import { AdvancedBillingController } from '../controllers/AdvancedBillingController';

const router = Router();

// ⚠️ IMPORTANT: Specific routes MUST come before generic param routes (/:id)
// Otherwise Express will match the param route first

// Status-based Queries (MUST be before /:id)
router.get('/status/active', AdvancedBillingController.getActiveBillings);
router.get('/status/overdue', AdvancedBillingController.getOverdueBillings);
router.get('/status/upcoming', AdvancedBillingController.getUpcomingBillings);
router.get('/status/expiring', AdvancedBillingController.getBillingsExpiringSoon);

// Billing Status Endpoints (MUST be before /:id)
router.get('/billing/ready', AdvancedBillingController.getActiveBillings);
router.get('/billing/overdue', AdvancedBillingController.getOverdueBillings);

// Statistics and Analytics (MUST be before /:id)
router.get('/stats/overview', AdvancedBillingController.getBillingStats);
router.get('/analytics/summary', AdvancedBillingController.getBillingSummary);
router.get('/analytics/revenue-trends', AdvancedBillingController.getRevenueTrends);

// Calendar Integration (MUST be before /:id)
router.get('/calendar/events', AdvancedBillingController.getBillingCalendarEvents);

// Frontend Compatibility (MUST be before /:id)
router.get('/frontend-compatible/all', AdvancedBillingController.getBillingsForFrontend);

// Alternative ID Access - MSSQL key (MUST be before generic /:id)
router.get('/billing-id/:billingId', AdvancedBillingController.getBillingByBillingId);

// Entity-based Queries (MUST be before generic /:id to avoid param collision)
router.get('/client/:clientId', AdvancedBillingController.getBillingsByClient);
router.get('/clinic/:clinicName', AdvancedBillingController.getBillingsByClinic);

// Generic routes - MUST come LAST after all specific routes
router.get('/', AdvancedBillingController.getAllBillings);
router.get('/:id', AdvancedBillingController.getBillingById);

// Mutations - POST, PUT, DELETE
router.post('/', AdvancedBillingController.createBilling);
router.put('/:id', AdvancedBillingController.updateBilling);
router.put('/:id/status', AdvancedBillingController.updateBillingStatus);
router.delete('/:id', AdvancedBillingController.deleteBilling);

// Bulk Operations
router.put('/bulk/bill-dates', AdvancedBillingController.bulkUpdateBillDates);

export default router;

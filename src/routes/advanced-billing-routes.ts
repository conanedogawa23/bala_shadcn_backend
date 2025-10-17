import { Router } from 'express';
import { AdvancedBillingController } from '../controllers/AdvancedBillingController';

const router = Router();

// Basic CRUD Operations
router.get('/', AdvancedBillingController.getAllBillings);
router.get('/:id', AdvancedBillingController.getBillingById);
router.post('/', AdvancedBillingController.createBilling);
router.put('/:id', AdvancedBillingController.updateBilling);
router.delete('/:id', AdvancedBillingController.deleteBilling);

// Alternative ID Access (MSSQL key)
router.get('/billing-id/:billingId', AdvancedBillingController.getBillingByBillingId);

// Status Management
router.put('/:id/status', AdvancedBillingController.updateBillingStatus);

// Status-based Queries
router.get('/status/active', AdvancedBillingController.getActiveBillings);
router.get('/status/overdue', AdvancedBillingController.getOverdueBillings);
router.get('/status/upcoming', AdvancedBillingController.getUpcomingBillings);
router.get('/status/expiring', AdvancedBillingController.getBillingsExpiringSoon);

// Entity-based Queries
router.get('/client/:clientId', AdvancedBillingController.getBillingsByClient);
router.get('/clinic/:clinicName', AdvancedBillingController.getBillingsByClinic);

// Calendar Integration
router.get('/calendar/events', AdvancedBillingController.getBillingCalendarEvents);

// Statistics and Analytics
router.get('/stats/overview', AdvancedBillingController.getBillingStats);
router.get('/analytics/summary', AdvancedBillingController.getBillingSummary);
router.get('/analytics/revenue-trends', AdvancedBillingController.getRevenueTrends);

// Bulk Operations
router.put('/bulk/bill-dates', AdvancedBillingController.bulkUpdateBillDates);

// Frontend Compatibility
router.get('/frontend-compatible/all', AdvancedBillingController.getBillingsForFrontend);

export default router;

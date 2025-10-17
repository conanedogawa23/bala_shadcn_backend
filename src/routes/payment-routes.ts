import { Router } from 'express';
import { PaymentController } from '../controllers/PaymentController';
import { 
  authenticate, 
  requirePermission, 
  requireClinicAccess, 
  verifyClinicExists,
  trackActivity 
} from '../middleware/authMiddleware';

const router = Router();

/**
 * @route   GET /api/v1/payments
 * @desc    Get all payments with filtering and pagination
 * @access  Public (temporarily for development)
 * @params  page, limit, status, paymentMethod, paymentType, clinicName, clientId, startDate, endDate, outstanding
 */
router.get('/', 
  PaymentController.getAllPayments
);

/**
 * @route   GET /api/v1/payments/:id
 * @desc    Get payment by ID
 * @access  Public (temporarily for development)
 */
router.get('/:id',
  PaymentController.getPaymentById
);

/**
 * @route   GET /api/v1/payments/clinic/:clinicName
 * @desc    Get payments by clinic name
 * @access  Public (temporarily for development)
 */
router.get('/clinic/:clinicName',
  PaymentController.getPaymentsByClinic
);

/**
 * @route   GET /api/v1/payments/client/:clientId
 * @desc    Get payments by client ID
 * @access  Private - Requires 'canViewPayments' permission
 */
router.get('/client/:clientId',
  authenticate,
  requirePermission('canViewPayments'),
  trackActivity,
  PaymentController.getPaymentsByClient
);

/**
 * @route   GET /api/v1/payments/stats/:clinicName
 * @desc    Get payment statistics for clinic
 * @access  Private - Requires clinic access and 'canViewReports' permission
 */
router.get('/stats/:clinicName',
  authenticate,
  requirePermission('canViewReports'),
  requireClinicAccess('clinicName'),
  verifyClinicExists,
  trackActivity,
  PaymentController.getPaymentStats
);

/**
 * @route   GET /api/v1/payments/outstanding/:clinicName
 * @desc    Get outstanding payments for clinic
 * @access  Private - Requires clinic access and 'canViewPayments' permission
 */
router.get('/outstanding/:clinicName',
  authenticate,
  requirePermission('canViewPayments'),
  requireClinicAccess('clinicName'),
  verifyClinicExists,
  trackActivity,
  PaymentController.getOutstandingPayments
);

/**
 * @route   GET /api/v1/payments/revenue/:clinicName
 * @desc    Get revenue data for clinic with date range
 * @access  Private - Requires clinic access and 'canViewReports' permission
 */
router.get('/revenue/:clinicName',
  authenticate,
  requirePermission('canViewReports'),
  requireClinicAccess('clinicName'),
  verifyClinicExists,
  trackActivity,
  PaymentController.getRevenueData
);

/**
 * @route   POST /api/v1/payments
 * @desc    Create new payment
 * @access  Private - Requires 'canCreatePayments' permission
 */
router.post('/',
  authenticate,
  requirePermission('canCreatePayments'),
  trackActivity,
  PaymentController.createPayment
);

/**
 * @route   PUT /api/v1/payments/:id
 * @desc    Update payment
 * @access  Private - Requires 'canEditPayments' permission
 */
router.put('/:id',
  authenticate,
  requirePermission('canEditPayments'),
  trackActivity,
  PaymentController.updatePayment
);

/**
 * @route   DELETE /api/v1/payments/:id
 * @desc    Soft delete payment (mark as deleted)
 * @access  Private - Requires 'canDeletePayments' permission
 */
router.delete('/:id',
  authenticate,
  requirePermission('canDeletePayments'),
  trackActivity,
  PaymentController.deletePayment
);

/**
 * @route   POST /api/v1/payments/:id/add-amount
 * @desc    Add payment amount to existing payment
 * @access  Private - Requires 'canEditPayments' permission
 */
router.post('/:id/add-amount',
  authenticate,
  requirePermission('canEditPayments'),
  trackActivity,
  PaymentController.addPaymentAmount
);

/**
 * @route   POST /api/v1/payments/:id/refund
 * @desc    Process payment refund
 * @access  Private - Requires 'canProcessRefunds' permission
 */
router.post('/:id/refund',
  authenticate,
  requirePermission('canProcessRefunds'),
  trackActivity,
  PaymentController.processRefund
);

export default router;

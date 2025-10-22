import { Router } from 'express';
import { OrderController } from '../controllers/OrderController';

const router = Router();

/**
 * @route   GET /api/v1/orders
 * @desc    Get all orders with filtering and pagination
 * @access  Public
 * @params  page, limit, status, paymentStatus, clinicName, clientId, startDate, endDate, search, readyToBill
 */
router.get('/', OrderController.getAllOrders);

/**
 * @route   GET /api/v1/orders/ready-for-billing
 * @desc    Get orders ready for billing
 * @access  Public
 * @params  clinicName, page, limit
 */
router.get('/ready-for-billing', OrderController.getOrdersReadyForBilling);

/**
 * @route   GET /api/v1/orders/report/overdue
 * @desc    Get overdue orders report
 * @access  Public
 * @params  clinicName, days, page, limit
 */
router.get('/report/overdue', OrderController.getOrdersOverdueReport);

/**
 * @route   GET /api/v1/orders/analytics/revenue
 * @desc    Get revenue analytics for clinic
 * @access  Public
 * @params  clinicName (required), startDate, endDate
 */
router.get('/analytics/revenue', OrderController.getRevenueAnalytics);

/**
 * @route   GET /api/v1/orders/analytics/products
 * @desc    Get product performance analytics
 * @access  Public
 * @params  startDate, endDate
 */
router.get('/analytics/products', OrderController.getProductPerformance);

/**
 * @route   GET /api/v1/orders/export
 * @desc    Export orders report
 * @access  Public
 * @params  clinicName, format (json|csv), startDate, endDate, limit
 */
router.get('/export', OrderController.exportOrdersReport);

/**
 * @route   GET /api/v1/orders/client/:clientId
 * @desc    Get orders by client ID
 * @access  Public
 * @params  limit
 */
router.get('/client/:clientId', OrderController.getOrdersByClient);

/**
 * @route   GET /api/v1/orders/clinic/:clinicName
 * @desc    Get orders by clinic with date range filtering
 * @access  Public
 * @params  startDate, endDate, status
 */
router.get('/clinic/:clinicName', OrderController.getOrdersByClinic);

/**
 * @route   GET /api/v1/orders/:id
 * @desc    Get order by ID or Order Number
 * @access  Public
 */
router.get('/:id', OrderController.getOrderById);

/**
 * @route   POST /api/v1/orders
 * @desc    Create new order
 * @access  Private
 */
router.post('/', OrderController.createOrder);

/**
 * @route   PUT /api/v1/orders/:id
 * @desc    Update order by ID or Order Number
 * @access  Private
 */
router.put('/:id', OrderController.updateOrder);

/**
 * @route   PUT /api/v1/orders/:id/status
 * @desc    Update order status with validation
 * @access  Private
 */
router.put('/:id/status', OrderController.updateOrderStatus);

/**
 * @route   PUT /api/v1/orders/:id/billing/ready
 * @desc    Mark order ready for billing
 * @access  Private
 */
router.put('/:id/billing/ready', OrderController.markReadyForBilling);

/**
 * @route   POST /api/v1/orders/:id/payment
 * @desc    Process payment for order
 * @access  Private
 */
router.post('/:id/payment', OrderController.processPayment);

/**
 * @route   PUT /api/v1/orders/:id/cancel
 * @desc    Cancel order with reason
 * @access  Private
 */
router.put('/:id/cancel', OrderController.cancelOrder);

/**
 * @route   GET /api/v1/orders/report/status
 * @desc    Get order status report
 * @access  Public
 * @params  clinicName (required), startDate, endDate
 */
router.get('/report/status', OrderController.getOrderStatusReport);

/**
 * @route   GET /api/v1/orders/client/:clientId/details
 * @desc    Get orders by client with advanced details
 * @access  Public
 * @params  page, limit, status, paymentStatus
 */
router.get('/client/:clientId/details', OrderController.getClientOrderDetails);

/**
 * @route   POST /api/v1/orders/bulk/ready-for-billing
 * @desc    Mark multiple orders as ready for billing
 * @access  Private
 */
router.post('/bulk/ready-for-billing', OrderController.bulkMarkReadyForBilling);

/**
 * @route   GET /api/v1/orders/report/pending-refund
 * @desc    Get orders pending refund
 * @access  Public
 * @params  clinicName (required), page, limit
 */
router.get('/report/pending-refund', OrderController.getOrdersPendingRefund);

/**
 * @route   GET /api/v1/orders/product/:productKey/history
 * @desc    Get order service history for a product
 * @access  Public
 * @params  clinicName, startDate, endDate
 */
router.get('/product/:productKey/history', OrderController.getProductServiceHistory);

export default router;
